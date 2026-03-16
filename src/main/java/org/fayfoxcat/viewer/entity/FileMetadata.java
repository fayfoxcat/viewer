package org.fayfoxcat.viewer.entity;

/**
 * 文件元数据实体类
 * 用于封装文件的元数据信息
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class FileMetadata {
    /**
     * 文件完整路径（支持压缩包格式：zipPath!entryName）
     */
    private String filePath;

    /**
     * 文件名称（不包含路径）
     */
    private String fileName;

    /**
     * 文件总行数
     */
    private int totalLines;

    /**
     * 文件大小（字节）
     */
    private long fileSize;

    /**
     * 最后修改时间（时间戳）
     */
    private long lastModified;

    /**
     * 文件编码格式
     */
    private String encoding;

    /**
     * 每页显示的行数
     */
    private int linesPerPage;

    /**
     * 总页数
     */
    private int totalPages;

    /**
     * 文件版本标识（用于缓存控制）
     */
    private String fileVersion;

    /**
     * 是否为压缩包内的文件
     */
    private boolean isZipEntry;

    /**
     * 压缩包路径（仅当 isZipEntry=true 时有效）
     */
    private String zipPath;

    /**
     * 压缩包内条目名称（仅当 isZipEntry=true 时有效）
     */
    private String entryName;

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public int getTotalLines() {
        return totalLines;
    }

    public void setTotalLines(int totalLines) {
        this.totalLines = totalLines;
    }

    public long getFileSize() {
        return fileSize;
    }

    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }

    public long getLastModified() {
        return lastModified;
    }

    public void setLastModified(long lastModified) {
        this.lastModified = lastModified;
    }

    public String getEncoding() {
        return encoding;
    }

    public void setEncoding(String encoding) {
        this.encoding = encoding;
    }

    public int getLinesPerPage() {
        return linesPerPage;
    }

    public void setLinesPerPage(int linesPerPage) {
        this.linesPerPage = linesPerPage;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public String getFileVersion() {
        return fileVersion;
    }

    public void setFileVersion(String fileVersion) {
        this.fileVersion = fileVersion;
    }

    public boolean isZipEntry() {
        return isZipEntry;
    }

    public void setZipEntry(boolean zipEntry) {
        isZipEntry = zipEntry;
    }

    public String getZipPath() {
        return zipPath;
    }

    public void setZipPath(String zipPath) {
        this.zipPath = zipPath;
    }

    public String getEntryName() {
        return entryName;
    }

    public void setEntryName(String entryName) {
        this.entryName = entryName;
    }
}
