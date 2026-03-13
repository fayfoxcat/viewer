package org.fayfoxcat.log.service;


import org.fayfoxcat.log.config.LogPatternsProperties;
import org.fayfoxcat.log.config.LogViewerProperties;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * 日志查看器服务
 * 提供文件和目录的操作功能，包括文件读取、搜索、压缩包处理等
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Service
public class LogViewerService {

    private final LogViewerProperties properties;
    private final LogPatternsProperties patternsProperties;

    // 正则配置缓存
    private Map<String, Object> logPatternsCache = null;

    // 压缩文件内容缓存
    private final Map<String, ZipEntryCache> zipEntryCache = new ConcurrentHashMap<>();

    /**
     * 压缩文件条目缓存
     */
    private static class ZipEntryCache {
        private final String[] lines;
        private final long lastModified;
        private final long fileSize;
        private final long cacheTime;

        public ZipEntryCache(String[] lines, long lastModified, long fileSize) {
            this.lines = lines;
            this.lastModified = lastModified;
            this.fileSize = fileSize;
            this.cacheTime = System.currentTimeMillis();
        }

        public boolean isValid(long currentLastModified, long currentFileSize) {
            // 检查文件是否被修改
            if (this.lastModified != currentLastModified || this.fileSize != currentFileSize) {
                return false;
            }
            // 检查缓存是否过期（30分钟）
            return (System.currentTimeMillis() - this.cacheTime) < 30 * 60 * 1000;
        }

        public String[] getLines() {
            return lines;
        }
    }

    /**
     * 从缓存获取压缩文件条目的行数组
     * 如果缓存不存在或已过期，则重新解压并缓存
     */
    private String[] getZipEntryLinesFromCache(String zipPath, String entryName) throws IOException {
        File zipFile = new File(zipPath);
        long lastModified = zipFile.lastModified();
        long fileSize = zipFile.length();

        String cacheKey = zipPath + "!" + entryName;
        ZipEntryCache cached = zipEntryCache.get(cacheKey);

        // 检查缓存是否有效
        if (cached != null && cached.isValid(lastModified, fileSize)) {
            return cached.getLines();
        }

        // 缓存无效或不存在，重新读取
        String content = readFileFromZip(zipPath, entryName);
        String[] lines = content.split("\n");

        // 更新缓存
        zipEntryCache.put(cacheKey, new ZipEntryCache(lines, lastModified, fileSize));

        // 清理过期缓存（简单策略：当缓存超过100个条目时清理）
        if (zipEntryCache.size() > 100) {
            cleanupExpiredCache();
        }

        return lines;
    }

    /**
     * 清理过期的缓存条目
     */
    private void cleanupExpiredCache() {
        long currentTime = System.currentTimeMillis();
        zipEntryCache.entrySet().removeIf(entry -> {
            ZipEntryCache cache = entry.getValue();
            return (currentTime - cache.cacheTime) > 30 * 60 * 1000; // 30分钟过期
        });
    }

    public LogViewerService(LogViewerProperties properties, LogPatternsProperties patternsProperties) {
        this.properties = properties;
        this.patternsProperties = patternsProperties;
    }

    /**
     * 检查路径是否在允许访问的白名单内
     *
     * @param requestedPath 请求的路径
     * @return 是否允许访问
     */
    public boolean isPathAllowedForViewer(String requestedPath) {
        if (requestedPath == null || requestedPath.trim().isEmpty()) return false;
        List<String> roots = properties.getEffectivePaths();
        if (roots == null || roots.isEmpty()) return false;

        String req;
        try {
            req = Paths.get(requestedPath).toAbsolutePath().normalize().toString()
                    .replace('\\', '/')
                    .toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            return false;
        }

        for (String root : roots) {
            if (root == null || root.trim().isEmpty()) continue;
            try {
                String r = Paths.get(root).toAbsolutePath().normalize().toString()
                        .replace('\\', '/')
                        .toLowerCase(Locale.ROOT);
                if (req.startsWith(r)) return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    /**
     * 列出指定路径下的文件
     *
     * @param path 路径
     * @return 文件列表
     */
    public List<FileInfo> listFiles(String path) {
        List<FileInfo> files = new ArrayList<>();
        if (!isPathAllowedForViewer(path)) {
            return files;
        }
        File directory = new File(path);

        if (!directory.exists() || !directory.isDirectory()) {
            return files;
        }

        File[] fileArray = directory.listFiles();
        if (fileArray != null) {
            for (File file : fileArray) {
                try {
                    FileInfo fileInfo = new FileInfo();
                    fileInfo.setName(file.getName());
                    fileInfo.setPath(file.getAbsolutePath());
                    fileInfo.setDirectory(file.isDirectory());
                    fileInfo.setSize(file.length());
                    fileInfo.setLastModified(file.lastModified());
                    try {
                        BasicFileAttributes attrs = Files.readAttributes(file.toPath(), BasicFileAttributes.class);
                        fileInfo.setCreatedTime(attrs.creationTime().toMillis());
                    } catch (Exception e) {
                        fileInfo.setCreatedTime(0L);
                    }
                    files.add(fileInfo);
                } catch (Exception ignored) {
                    // 跳过无法访问的文件
                }
            }
        }

        return files;
    }

    /**
     * 在指定根路径下递归搜索文件名（用于左侧文件搜索框）
     *
     * @param rootPath 根路径（必须在白名单 paths 内）
     * @param keyword  关键字（大小写不敏感）
     * @return 匹配到的文件列表（最多返回 2000 条）
     */
    public List<FileInfo> searchFiles(String rootPath, String keyword) {
        List<FileInfo> results = new ArrayList<>();
        if (!isPathAllowedForViewer(rootPath) || keyword == null || keyword.trim().isEmpty()) {
            return results;
        }

        String kw = keyword.trim().toLowerCase(Locale.ROOT);
        int max = 2000;

        Path root;
        try {
            root = Paths.get(rootPath).toAbsolutePath().normalize();
        } catch (Exception e) {
            return results;
        }

        try (Stream<Path> stream = Files.walk(root)) {
            stream.limit(200000).forEach(p -> {
                if (results.size() >= max) return;
                try {
                    File f = p.toFile();
                    if (!f.exists() || f.isDirectory()) return;
                    String name = f.getName();
                    if (!name.toLowerCase(Locale.ROOT).contains(kw)) return;

                    FileInfo info = new FileInfo();
                    info.setName(name);
                    info.setPath(f.getAbsolutePath());
                    info.setDirectory(false);
                    info.setSize(f.length());
                    info.setLastModified(f.lastModified());
                    try {
                        BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
                        info.setCreatedTime(attrs.creationTime().toMillis());
                    } catch (Exception e) {
                        info.setCreatedTime(0L);
                    }
                    results.add(info);
                } catch (Exception ignored) {
                }
            });
        } catch (Exception ignored) {
        }

        return results;
    }

    /**
     * 读取文件内容
     *
     * @param filePath 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    public String readFileContent(String filePath) throws IOException {
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }
        File file = new File(filePath);

        // 使用配置的文件大小限制
        long maxFileSize = properties.getMaxFileSizeMb() * 1024L * 1024L;
        if (file.length() > maxFileSize) {
            return readFileTail(filePath, properties.getTailLines());
        }

        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        return content.toString();
    }

    /**
     * 读取文件尾部内容
     *
     * @param filePath 文件路径
     * @param lines    行数
     * @return 文件内容
     * @throws IOException IO异常
     */
    private String readFileTail(String filePath, int lines) throws IOException {
        List<String> lineList = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineList.add(line);
                if (lineList.size() > lines) {
                    lineList.remove(0);
                }
            }
        }

        StringBuilder content = new StringBuilder();
        content.append("=== 文件过大，仅显示最后 ").append(lines).append(" 行 ===\n\n");
        for (String line : lineList) {
            content.append(line).append("\n");
        }
        return content.toString();
    }

    /**
     * 搜索文件内容（支持正则表达式）
     *
     * @param filePath 文件路径
     * @param keyword  搜索关键词或正则表达式
     * @param useRegex 是否使用正则表达式
     * @return 搜索结果
     * @throws IOException IO异常
     */
    public List<String> searchFileContent(String filePath, String keyword, boolean useRegex) throws IOException {
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }
        List<String> matches = new ArrayList<>();
        int maxResults = 500;

        Pattern regexPattern = null;
        if (useRegex) {
            try {
                regexPattern = Pattern.compile(keyword);
            } catch (Exception e) {
                useRegex = false;
            }
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
            String line;
            int lineNumber = 1;
            while ((line = reader.readLine()) != null && matches.size() < maxResults) {
                boolean match = (useRegex && regexPattern != null)
                        ? regexPattern.matcher(line).find()
                        : line.toLowerCase().contains(keyword.toLowerCase());

                if (match) {
                    matches.add(lineNumber + ": " + line);
                }
                lineNumber++;
            }
        }
        return matches;
    }

    /**
     * 列出压缩文件中的文件（支持 .gz 文件）
     *
     * @param zipPath 压缩文件路径
     * @param prefix  压缩包内目录前缀（可选，支持懒加载；例如 "a/b/"）
     * @return 压缩文件中的文件列表
     * @throws IOException IO异常
     */
    public List<FileInfo> listFilesInZip(String zipPath, String prefix) throws IOException {
        if (!isPathAllowedForViewer(zipPath)) {
            return new ArrayList<>();
        }
        List<FileInfo> files = new ArrayList<>();
        String pfx = prefix == null ? "" : prefix.trim();
        pfx = pfx.replace('\\', '/');
        if (!pfx.isEmpty() && !pfx.endsWith("/")) {
            pfx = pfx + "/";
        }

        // 判断是否为 gzip 文件
        if (zipPath.toLowerCase().endsWith(".gz")) {
            // gzip 文件只包含一个文件，直接返回该文件信息
            File gzFile = new File(zipPath);
            FileInfo fileInfo = new FileInfo();
            // 去掉 .gz 后缀作为文件名
            String name = gzFile.getName();
            if (name.endsWith(".gz")) {
                name = name.substring(0, name.length() - 3);
            }
            if (!pfx.isEmpty()) {
                return files;
            }
            fileInfo.setName(name);
            fileInfo.setPath(zipPath + "!" + name);
            fileInfo.setDirectory(false);
            fileInfo.setSize(gzFile.length());
            fileInfo.setLastModified(gzFile.lastModified());
            fileInfo.setCreatedTime(0L);
            fileInfo.setEntryName(name);
            files.add(fileInfo);
            return files;
        }

        // 处理 zip/jar 文件
        try (ZipFile zipFile = new ZipFile(zipPath)) {
            Map<String, ZipEntry> entryMap = new HashMap<>();
            Enumeration<? extends ZipEntry> entries = zipFile.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry == null) continue;
                String entryName = entry.getName().replace('\\', '/');
                entryMap.put(entryName, entry);
            }

            Set<String> dirChildren = new HashSet<>();
            List<String> fileChildren = new ArrayList<>();

            for (String entryName : entryMap.keySet()) {
                if (!pfx.isEmpty() && !entryName.startsWith(pfx)) continue;
                String rest = entryName.substring(pfx.length());
                if (rest.isEmpty()) continue;
                int slashIdx = rest.indexOf('/');
                if (slashIdx >= 0) {
                    String childDir = rest.substring(0, slashIdx + 1);
                    dirChildren.add(pfx + childDir);
                } else {
                    fileChildren.add(pfx + rest);
                }
            }

            for (String dir : dirChildren) {
                String displayName = dir;
                if (displayName.endsWith("/")) {
                    displayName = displayName.substring(0, displayName.length() - 1);
                }
                if (displayName.contains("/")) {
                    displayName = displayName.substring(displayName.lastIndexOf("/") + 1);
                }
                FileInfo fileInfo = new FileInfo();
                fileInfo.setName(displayName);
                fileInfo.setPath(zipPath + "!" + dir);
                fileInfo.setEntryName(dir);
                fileInfo.setDirectory(true);
                fileInfo.setSize(0L);
                fileInfo.setLastModified(0L);
                fileInfo.setCreatedTime(0L);
                files.add(fileInfo);
            }

            for (String fileEntryName : fileChildren) {
                ZipEntry entry = entryMap.get(fileEntryName);
                if (entry == null || entry.isDirectory()) continue;
                String displayName = fileEntryName;
                if (displayName.contains("/")) {
                    displayName = displayName.substring(displayName.lastIndexOf("/") + 1);
                }
                FileInfo fileInfo = new FileInfo();
                fileInfo.setName(displayName);
                fileInfo.setPath(zipPath + "!" + fileEntryName);
                fileInfo.setEntryName(fileEntryName);
                fileInfo.setDirectory(false);
                fileInfo.setSize(entry.getSize());
                fileInfo.setLastModified(entry.getTime());
                fileInfo.setCreatedTime(entry.getTime());
                files.add(fileInfo);
            }
        }
        return files;
    }

    /**
     * 读取压缩文件中的文件内容（支持 .gz 文件）
     *
     * @param zipPath   压缩文件路径
     * @param entryName 压缩文件中的文件名称
     * @return 文件内容
     * @throws IOException IO异常
     */
    public String readFileFromZip(String zipPath, String entryName) throws IOException {
        if (!isPathAllowedForViewer(zipPath)) {
            throw new FileNotFoundException("Not allowed");
        }
        // 判断是否为 gzip 文件
        if (zipPath.toLowerCase().endsWith(".gz")) {
            return readGzipFile(zipPath);
        }

        // 处理 zip/jar 文件
        StringBuilder content = new StringBuilder();
        try (ZipFile zipFile = new ZipFile(zipPath)) {
            ZipEntry entry = zipFile.getEntry(entryName);
            if (entry != null) {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(zipFile.getInputStream(entry), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        content.append(line).append("\n");
                    }
                }
            }
        }
        return content.toString();
    }

    /**
     * 读取 gzip 文件内容
     *
     * @param gzipPath gzip 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    private String readGzipFile(String gzipPath) throws IOException {
        File file = new File(gzipPath);

        // 使用配置的文件大小限制（压缩后）
        long maxFileSize = properties.getMaxFileSizeMb() * 1024L * 1024L;
        if (file.length() > maxFileSize) {
            return readGzipFileTail(gzipPath, properties.getTailLines());
        }

        StringBuilder content = new StringBuilder();
        try (GZIPInputStream gzipInputStream = new GZIPInputStream(Files.newInputStream(Paths.get(gzipPath)));
             BufferedReader reader = new BufferedReader(new InputStreamReader(gzipInputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        return content.toString();
    }

    /**
     * 读取 gzip 文件尾部内容
     *
     * @param gzipPath gzip 文件路径
     * @param lines    行数
     * @return 文件内容
     * @throws IOException IO异常
     */
    private String readGzipFileTail(String gzipPath, int lines) throws IOException {
        List<String> lineList = new ArrayList<>();
        try (GZIPInputStream gzipInputStream = new GZIPInputStream(Files.newInputStream(Paths.get(gzipPath)));
             BufferedReader reader = new BufferedReader(new InputStreamReader(gzipInputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineList.add(line);
                if (lineList.size() > lines) {
                    lineList.remove(0);
                }
            }
        }

        StringBuilder content = new StringBuilder();
        content.append("=== 文件过大，仅显示最后 ").append(lines).append(" 行 ===\n\n");
        for (String line : lineList) {
            content.append(line).append("\n");
        }
        return content.toString();
    }

    /**
     * 获取文件元数据
     *
     * @param filePath 文件路径（支持压缩包格式：zipPath!entryName）
     * @return 文件元数据
     * @throws IOException IO异常
     */
    public FileMetadata getFileMetadata(String filePath) throws IOException {
        // 检查是否为压缩包内的文件
        if (filePath.contains("!")) {
            return getZipEntryMetadata(filePath);
        }

        // 普通文件处理
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }

        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new FileNotFoundException("File not found: " + filePath);
        }

        FileMetadata metadata = new FileMetadata();

        // 使用索引缓存获取总行数
        int totalLines = FileIndexCache.getTotalLines(filePath);
        int linesPerPage = 1000;
        int totalPages = (int) Math.ceil((double) totalLines / linesPerPage);

        metadata.setFilePath(filePath);
        metadata.setFileName(file.getName());
        metadata.setTotalLines(totalLines);
        metadata.setFileSize(file.length());
        metadata.setLastModified(file.lastModified());
        metadata.setEncoding("UTF-8");
        metadata.setLinesPerPage(linesPerPage);
        metadata.setTotalPages(totalPages);
        metadata.setFileVersion(file.lastModified() + "-" + file.length());
        metadata.setZipEntry(false);

        return metadata;
    }

    /**
     * 获取压缩包内文件的元数据
     *
     * @param zipEntryPath 压缩包文件路径（格式：zipPath!entryName）
     * @return 文件元数据
     * @throws IOException IO异常
     */
    private FileMetadata getZipEntryMetadata(String zipEntryPath) throws IOException {
        int idx = zipEntryPath.indexOf('!');
        String zipPath = zipEntryPath.substring(0, idx);
        String entryName = zipEntryPath.substring(idx + 1);

        if (!isPathAllowedForViewer(zipPath)) {
            throw new FileNotFoundException("Not allowed");
        }

        File zipFile = new File(zipPath);
        if (!zipFile.exists() || !zipFile.isFile()) {
            throw new FileNotFoundException("Zip file not found: " + zipPath);
        }

        // 读取压缩包内文件内容来计算行数
        String content = readFileFromZip(zipPath, entryName);
        String[] lines = content.split("\n");
        int totalLines = lines.length;

        // 如果最后一行是空的，减去1
        if (totalLines > 0 && lines[totalLines - 1].isEmpty()) {
            totalLines--;
        }

        int linesPerPage = 1000;
        int totalPages = Math.max(1, (int) Math.ceil((double) totalLines / linesPerPage));

        // 获取压缩包文件信息作为基准
        long zipLastModified = zipFile.lastModified();
        long zipSize = zipFile.length();

        FileMetadata metadata = new FileMetadata();
        metadata.setFilePath(zipEntryPath);
        metadata.setFileName(entryName.contains("/") ? entryName.substring(entryName.lastIndexOf("/") + 1) : entryName);
        metadata.setTotalLines(totalLines);
        metadata.setFileSize(content.getBytes(StandardCharsets.UTF_8).length);
        metadata.setLastModified(zipLastModified);
        metadata.setEncoding("UTF-8");
        metadata.setLinesPerPage(linesPerPage);
        metadata.setTotalPages(totalPages);
        metadata.setFileVersion(zipLastModified + "-" + zipSize + "-" + entryName.hashCode());
        metadata.setZipEntry(true);
        metadata.setZipPath(zipPath);
        metadata.setEntryName(entryName);

        return metadata;
    }

    /**
     * 分页读取文件内容
     *
     * @param filePath 文件路径（支持压缩包格式：zipPath!entryName）
     * @param page     页码（从1开始）
     * @param pageSize 每页行数
     * @return 分页内容
     * @throws IOException IO异常
     */
    public PageContent readFileContentByPage(String filePath, int page, int pageSize) throws IOException {
        // 检查是否为压缩包内的文件
        if (filePath.contains("!")) {
            return readZipEntryContentByPage(filePath, page, pageSize);
        }

        // 普通文件处理
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }

        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new FileNotFoundException("File not found: " + filePath);
        }

        // 获取文件索引
        FileIndexCache.FileIndex index = FileIndexCache.getOrBuildIndex(filePath);
        int totalLines = index.totalLines;
        int totalPages = (int) Math.ceil((double) totalLines / pageSize);

        // 校验页码
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        // 计算行范围
        int startLine = (page - 1) * pageSize + 1;
        int endLine = Math.min(startLine + pageSize - 1, totalLines);

        // 读取行内容
        List<String> lines = FileIndexCache.readLines(filePath, startLine, endLine);

        // 构建响应
        PageContent result = new PageContent();
        result.setSuccess(true);
        result.setPage(page);
        result.setPageSize(pageSize);
        result.setTotalPages(totalPages);
        result.setTotalLines(totalLines);
        result.setStartLine(startLine);
        result.setEndLine(endLine);
        result.setLines(lines);
        result.setHasNext(page < totalPages);
        result.setHasPrev(page > 1);
        result.setFileVersion(file.lastModified() + "-" + file.length());
        result.setZipEntry(false);

        return result;
    }

    /**
     * 分页读取压缩包内文件内容
     *
     * @param zipEntryPath 压缩包文件路径（格式：zipPath!entryName）
     * @param page         页码（从1开始）
     * @param pageSize     每页行数
     * @return 分页内容
     * @throws IOException IO异常
     */
    private PageContent readZipEntryContentByPage(String zipEntryPath, int page, int pageSize) throws IOException {
        int idx = zipEntryPath.indexOf('!');
        String zipPath = zipEntryPath.substring(0, idx);
        String entryName = zipEntryPath.substring(idx + 1);

        if (!isPathAllowedForViewer(zipPath)) {
            throw new FileNotFoundException("Not allowed");
        }

        // 使用缓存获取压缩文件内容
        String[] allLines = getZipEntryLinesFromCache(zipPath, entryName);
        int totalLines = allLines.length;

        // 如果最后一行是空的，减去1
        if (totalLines > 0 && allLines[totalLines - 1].isEmpty()) {
            totalLines--;
        }

        int totalPages = Math.max(1, (int) Math.ceil((double) totalLines / pageSize));

        // 校验页码
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        // 计算行范围
        int startLine = (page - 1) * pageSize + 1;
        int endLine = Math.min(startLine + pageSize - 1, totalLines);

        // 提取指定页的行
        List<String> lines = new ArrayList<>();
        for (int i = startLine - 1; i < endLine && i < totalLines; i++) {
            lines.add(allLines[i]);
        }

        // 获取压缩包文件信息
        File zipFile = new File(zipPath);
        long zipLastModified = zipFile.lastModified();
        long zipSize = zipFile.length();

        // 构建响应
        PageContent result = new PageContent();
        result.setSuccess(true);
        result.setPage(page);
        result.setPageSize(pageSize);
        result.setTotalPages(totalPages);
        result.setTotalLines(totalLines);
        result.setStartLine(startLine);
        result.setEndLine(endLine);
        result.setLines(lines);
        result.setHasNext(page < totalPages);
        result.setHasPrev(page > 1);
        result.setFileVersion(zipLastModified + "-" + zipSize + "-" + entryName.hashCode());
        result.setZipEntry(true);

        return result;
    }

    /**
     * 服务端搜索文件内容（增强版）
     *
     * @param filePath      文件路径（支持压缩包格式：zipPath!entryName）
     * @param keyword       搜索关键词
     * @param useRegex      是否使用正则表达式
     * @param caseSensitive 是否区分大小写
     * @param contextLines  上下文行数
     * @param maxResults    最大结果数
     * @param patternName   预定义模式名称
     * @return 搜索结果
     * @throws IOException IO异常
     */
    public SearchResult searchFileContentAdvanced(String filePath, String keyword,
                                                  boolean useRegex, boolean caseSensitive,
                                                  int contextLines, int maxResults,
                                                  String patternName) throws IOException {
        // 检查是否为压缩包内的文件
        if (filePath.contains("!")) {
            return searchZipEntryContentAdvanced(filePath, keyword, useRegex, caseSensitive, contextLines, maxResults, patternName);
        }

        // 普通文件处理
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }

        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new FileNotFoundException("File not found: " + filePath);
        }

        return performSearch(filePath, keyword, useRegex, caseSensitive, contextLines, maxResults, patternName,
                () -> {
                    List<String> allLines = new ArrayList<>();
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            allLines.add(line);
                        }
                    }
                    return allLines;
                },
                file.lastModified() + "-" + file.length());
    }

    /**
     * 搜索压缩包内文件内容（增强版）
     *
     * @param zipEntryPath  压缩包文件路径（格式：zipPath!entryName）
     * @param keyword       搜索关键词
     * @param useRegex      是否使用正则表达式
     * @param caseSensitive 是否区分大小写
     * @param contextLines  上下文行数
     * @param maxResults    最大结果数
     * @param patternName   预定义模式名称
     * @return 搜索结果
     * @throws IOException IO异常
     */
    private SearchResult searchZipEntryContentAdvanced(String zipEntryPath, String keyword,
                                                       boolean useRegex, boolean caseSensitive,
                                                       int contextLines, int maxResults,
                                                       String patternName) throws IOException {
        int idx = zipEntryPath.indexOf('!');
        String zipPath = zipEntryPath.substring(0, idx);
        String entryName = zipEntryPath.substring(idx + 1);

        if (!isPathAllowedForViewer(zipPath)) {
            throw new FileNotFoundException("Not allowed");
        }

        File zipFile = new File(zipPath);
        String fileVersion = zipFile.lastModified() + "-" + zipFile.length() + "-" + entryName.hashCode();

        return performSearch(zipEntryPath, keyword, useRegex, caseSensitive, contextLines, maxResults, patternName,
                () -> {
                    String content = readFileFromZip(zipPath, entryName);
                    String[] lines = content.split("\n");
                    List<String> allLines = new ArrayList<>();
                    Collections.addAll(allLines, lines);
                    return allLines;
                },
                fileVersion);
    }

    /**
     * 执行搜索的通用方法
     * 支持正则表达式、大小写敏感、上下文行数等高级搜索功能
     *
     * @param filePath      文件路径
     * @param keyword       搜索关键词
     * @param useRegex      是否使用正则表达式
     * @param caseSensitive 是否区分大小写
     * @param contextLines  上下文行数
     * @param maxResults    最大结果数
     * @param patternName   预定义模式名称（可选）
     * @param linesProvider 行内容提供者函数式接口
     * @param fileVersion   文件版本标识
     * @return 搜索结果，包含匹配行、上下文、匹配范围等信息
     * @throws IOException IO异常
     */
    private SearchResult performSearch(String filePath, String keyword, boolean useRegex, boolean caseSensitive,
                                       int contextLines, int maxResults, String patternName,
                                       LinesProvider linesProvider, String fileVersion) throws IOException {
        long startTime = System.currentTimeMillis();

        // 如果指定了预定义模式，使用模式的正则
        if (patternName != null && !patternName.trim().isEmpty()) {
            Map<String, Object> patterns = getLogPatterns();
            @SuppressWarnings("unchecked")
            Map<String, Object> patternsMap = (Map<String, Object>) patterns.get("patterns");
            if (patternsMap != null && patternsMap.containsKey(patternName)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> patternConfig = (Map<String, Object>) patternsMap.get(patternName);
                keyword = (String) patternConfig.get("regex");
                useRegex = true;
                caseSensitive = (Boolean) patternConfig.getOrDefault("caseSensitive", false);
            }
        }

        List<SearchResult.MatchInfo> matches = new ArrayList<>();
        int totalMatches = 0;
        int pageSize = 1000;

        Pattern regexPattern = null;
        if (useRegex) {
            try {
                int flags = caseSensitive ? 0 : Pattern.CASE_INSENSITIVE;
                regexPattern = Pattern.compile(keyword, flags);
            } catch (Exception e) {
                SearchResult error = new SearchResult();
                error.setSuccess(false);
                error.setError("Invalid regex pattern: " + e.getMessage());
                return error;
            }
        }

        // 读取文件并搜索
        List<String> allLines = linesProvider.getLines();

        // 搜索匹配行
        for (int i = 0; i < allLines.size() && matches.size() < maxResults; i++) {
            String line = allLines.get(i);
            boolean isMatch = false;
            List<SearchResult.MatchRange> matchRanges = new ArrayList<>();

            if (useRegex && regexPattern != null) {
                Matcher matcher = regexPattern.matcher(line);
                while (matcher.find()) {
                    isMatch = true;
                    matchRanges.add(new SearchResult.MatchRange(matcher.start(), matcher.end()));
                }
            } else if (!useRegex) {
                String searchLine = caseSensitive ? line : line.toLowerCase();
                String searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
                int index = searchLine.indexOf(searchKeyword);
                if (index >= 0) {
                    isMatch = true;
                    while (index >= 0) {
                        matchRanges.add(new SearchResult.MatchRange(index, index + keyword.length()));
                        index = searchLine.indexOf(searchKeyword, index + 1);
                    }
                }
            }

            if (isMatch) {
                totalMatches++;

                SearchResult.MatchInfo match = new SearchResult.MatchInfo();
                int lineNumber = i + 1;
                match.setLineNumber(lineNumber);
                match.setContent(line);
                match.setMatchRanges(matchRanges);
                match.setPage((int) Math.ceil((double) lineNumber / pageSize));

                // 添加上下文
                SearchResult.ContextInfo context = new SearchResult.ContextInfo();
                List<String> before = new ArrayList<>();
                List<String> after = new ArrayList<>();

                for (int j = Math.max(0, i - contextLines); j < i; j++) {
                    before.add(allLines.get(j));
                }
                for (int j = i + 1; j < Math.min(allLines.size(), i + 1 + contextLines); j++) {
                    after.add(allLines.get(j));
                }

                context.setBefore(before);
                context.setAfter(after);
                match.setContext(context);

                matches.add(match);
            }
        }

        long searchTime = System.currentTimeMillis() - startTime;

        // 构建响应
        SearchResult result = new SearchResult();
        result.setSuccess(true);
        result.setKeyword(keyword);
        result.setTotalMatches(totalMatches);
        result.setReturnedMatches(matches.size());
        result.setTruncated(totalMatches > maxResults);
        result.setSearchTime(searchTime);
        result.setMatches(matches);
        result.setFileVersion(fileVersion);

        return result;
    }

    /**
     * 行内容提供者接口
     */
    @FunctionalInterface
    private interface LinesProvider {
        List<String> getLines() throws IOException;
    }

    /**
     * 获取日志模式配置
     * 将 LogPatternsProperties 转换为前端可用的格式
     *
     * @return 正则表达式配置
     */
    public Map<String, Object> getLogPatterns() {
        if (logPatternsCache != null) {
            return logPatternsCache;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("version", "1.0");

        // 转换 rules
        Map<String, Object> rulesMap = new LinkedHashMap<>();
        if (patternsProperties.getRules() != null) {
            patternsProperties.getRules().forEach((key, rule) -> {
                Map<String, Object> ruleData = new LinkedHashMap<>();
                ruleData.put("name", rule.getName());
                ruleData.put("regex", rule.getRegex());
                ruleData.put("className", rule.getClassName());
                ruleData.put("color", rule.getColor());
                ruleData.put("description", rule.getDescription());
                ruleData.put("highlight", rule.isHighlight());
                rulesMap.put(key, ruleData);
            });
        }
        result.put("patterns", rulesMap);

        // 转换 presets
        Map<String, Object> presetsMap = new LinkedHashMap<>();
        if (patternsProperties.getPresets() != null) {
            patternsProperties.getPresets().forEach((key, preset) -> {
                Map<String, Object> presetData = new LinkedHashMap<>();
                presetData.put("name", preset.getName());
                presetData.put("patterns", preset.getPatterns());
                presetData.put("description", preset.getDescription());
                presetsMap.put(key, presetData);
            });
        }
        result.put("presets", presetsMap);

        logPatternsCache = result;
        return result;
    }

    /**
     * 文件信息类
     * 存储文件的基本信息
     */
    public static class FileInfo {
        private String name; // 文件名称
        private String path; // 文件路径
        private boolean directory; // 是否为目录
        private long size; // 文件大小
        private long lastModified; // 最后修改时间
        private long createdTime; // 创建时间（部分文件系统/压缩包可能不可用）
        private String entryName; // 压缩包内条目名称（仅 zip/jar/gz 场景使用）

        // getters and setters
        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public boolean isDirectory() {
            return directory;
        }

        public void setDirectory(boolean directory) {
            this.directory = directory;
        }

        public long getSize() {
            return size;
        }

        public void setSize(long size) {
            this.size = size;
        }

        public long getLastModified() {
            return lastModified;
        }

        public void setLastModified(long lastModified) {
            this.lastModified = lastModified;
        }

        public long getCreatedTime() {
            return createdTime;
        }

        public void setCreatedTime(long createdTime) {
            this.createdTime = createdTime;
        }

        public String getEntryName() {
            return entryName;
        }

        public void setEntryName(String entryName) {
            this.entryName = entryName;
        }
    }
}