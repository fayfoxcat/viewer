package org.fayfoxcat.log.service;

import org.fayfoxcat.log.config.LogViewerProperties;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * 日志查看器服务
 * 提供文件和目录的操作功能
 */
@Service
public class LogViewerService {

    private final LogViewerProperties properties;

    public LogViewerService(LogViewerProperties properties) {
        this.properties = properties;
    }

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
     * @param rootPath 根路径（必须在白名单 paths 内）
     * @param keyword 关键字（大小写不敏感）
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
                    if (name == null || !name.toLowerCase(Locale.ROOT).contains(kw)) return;

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
     * @param filePath 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    public String readFileContent(String filePath) throws IOException {
        if (!isPathAllowedForViewer(filePath)) {
            throw new FileNotFoundException("Not allowed");
        }
        File file = new File(filePath);
        
        // 文件大小限制（10MB）
        if (file.length() > 10 * 1024 * 1024) {
            return readFileTail(filePath, 5000);
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
     * @param filePath 文件路径
     * @param lines 行数
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
     * @param filePath 文件路径
     * @param keyword 搜索关键词或正则表达式
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
        
        Pattern pattern = null;
        if (useRegex) {
            try {
                pattern = Pattern.compile(keyword);
            } catch (Exception e) {
                useRegex = false;
            }
        }
        
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
            String line;
            int lineNumber = 1;
            while ((line = reader.readLine()) != null && matches.size() < maxResults) {
                boolean match = useRegex && pattern != null 
                    ? pattern.matcher(line).find() 
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
     * @param zipPath 压缩文件路径
     * @param prefix 压缩包内目录前缀（可选，支持懒加载；例如 "a/b/"）
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
                if (entry == null || entry.getName() == null) continue;
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

    public List<FileInfo> listFilesInZip(String zipPath) throws IOException {
        return listFilesInZip(zipPath, "");
    }

    /**
     * 读取压缩文件中的文件内容（支持 .gz 文件）
     * @param zipPath 压缩文件路径
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
     * @param gzipPath gzip 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    private String readGzipFile(String gzipPath) throws IOException {
        File file = new File(gzipPath);
        
        // 文件大小限制（压缩后10MB）
        if (file.length() > 10 * 1024 * 1024) {
            return readGzipFileTail(gzipPath, 5000);
        }
        
        StringBuilder content = new StringBuilder();
        try (GZIPInputStream gzipInputStream = new GZIPInputStream(new FileInputStream(gzipPath));
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
     * @param gzipPath gzip 文件路径
     * @param lines 行数
     * @return 文件内容
     * @throws IOException IO异常
     */
    private String readGzipFileTail(String gzipPath, int lines) throws IOException {
        List<String> lineList = new ArrayList<>();
        try (GZIPInputStream gzipInputStream = new GZIPInputStream(new FileInputStream(gzipPath));
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