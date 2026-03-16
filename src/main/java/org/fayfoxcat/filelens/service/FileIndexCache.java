package org.fayfoxcat.filelens.service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 文件索引缓存管理器
 * 用于加速大文件的行号定位
 */
public class FileIndexCache {

    // 最大缓存文件数
    private static final int MAX_CACHE_SIZE = 100;

    // 文件索引缓存
    private static final Map<String, FileIndex> indexCache = new ConcurrentHashMap<>();

    // LRU队列
    private static final LinkedList<String> lruQueue = new LinkedList<>();

    /**
     * 文件索引信息
     */
    public static class FileIndex {
        String filePath;
        long lastModified;
        long fileSize;
        int totalLines;
        long cacheTime;

        public FileIndex(String filePath, long lastModified, long fileSize) {
            this.filePath = filePath;
            this.lastModified = lastModified;
            this.fileSize = fileSize;
            this.cacheTime = System.currentTimeMillis();
        }
    }

    /**
     * 获取或构建文件索引
     *
     * @param filePath 文件路径
     * @return 文件索引信息
     * @throws IOException IO异常
     */
    public static FileIndex getOrBuildIndex(String filePath) throws IOException {
        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new FileNotFoundException("File not found: " + filePath);
        }

        long lastModified = file.lastModified();
        long fileSize = file.length();

        // 检查缓存
        FileIndex cached = indexCache.get(filePath);
        if (cached != null && cached.lastModified == lastModified && cached.fileSize == fileSize) {
            // 缓存有效，更新LRU
            updateLRU(filePath);
            return cached;
        }

        // 构建新索引
        FileIndex index = buildIndex(filePath, lastModified, fileSize);

        // 存入缓存
        putCache(filePath, index);

        return index;
    }

    /**
     * 构建文件索引
     *
     * @param filePath     文件路径
     * @param lastModified 最后修改时间
     * @param fileSize     文件大小
     * @return 文件索引信息
     * @throws IOException IO异常
     */
    private static FileIndex buildIndex(String filePath, long lastModified, long fileSize) throws IOException {
        FileIndex index = new FileIndex(filePath, lastModified, fileSize);

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {
            int lineCount = 0;
            while (reader.readLine() != null) {
                lineCount++;
            }
            index.totalLines = lineCount;
        }

        return index;
    }

    /**
     * 读取指定行范围的内容
     *
     * @param filePath  文件路径
     * @param startLine 起始行号（从1开始）
     * @param endLine   结束行号（包含）
     * @return 行内容列表
     * @throws IOException IO异常
     */
    public static List<String> readLines(String filePath, int startLine, int endLine) throws IOException {
        FileIndex index = getOrBuildIndex(filePath);

        if (startLine < 1 || startLine > index.totalLines) {
            return new ArrayList<>();
        }

        endLine = Math.min(endLine, index.totalLines);

        List<String> lines = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(Paths.get(filePath)), StandardCharsets.UTF_8))) {

            // 跳过不需要的行
            int skipLines = startLine - 1;
            for (int i = 0; i < skipLines; i++) {
                reader.readLine();
            }

            // 读取目标行
            int currentLine = startLine;
            String line;
            while (currentLine <= endLine && (line = reader.readLine()) != null) {
                lines.add(line);
                currentLine++;
            }
        }

        return lines;
    }

    /**
     * 获取文件总行数
     *
     * @param filePath 文件路径
     * @return 文件总行数
     * @throws IOException IO异常
     */
    public static int getTotalLines(String filePath) throws IOException {
        FileIndex index = getOrBuildIndex(filePath);
        return index.totalLines;
    }

    /**
     * 清除指定文件的缓存
     *
     * @param filePath 文件路径
     */
    public static void clearCache(String filePath) {
        indexCache.remove(filePath);
        lruQueue.remove(filePath);
    }

    /**
     * 清除所有缓存
     */
    public static void clearAllCache() {
        indexCache.clear();
        lruQueue.clear();
    }

    /**
     * 更新LRU队列
     *
     * @param key 缓存键
     */
    private static synchronized void updateLRU(String key) {
        lruQueue.remove(key);
        lruQueue.addFirst(key);
    }

    /**
     * 存入缓存
     *
     * @param key   缓存键
     * @param index 文件索引信息
     */
    private static synchronized void putCache(String key, FileIndex index) {
        // 检查缓存大小
        if (indexCache.size() >= MAX_CACHE_SIZE && !indexCache.containsKey(key)) {
            // 移除最久未使用的
            String oldest = lruQueue.removeLast();
            indexCache.remove(oldest);
        }

        indexCache.put(key, index);
        lruQueue.remove(key);
        lruQueue.addFirst(key);
    }
}
