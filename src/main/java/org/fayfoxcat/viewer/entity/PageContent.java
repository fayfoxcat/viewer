package org.fayfoxcat.viewer.entity;

import java.util.List;

/**
 * 分页内容实体类
 * 用于封装文件分页读取的结果
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class PageContent {
    /**
     * 操作是否成功
     */
    private boolean success;

    /**
     * 当前页码（从1开始）
     */
    private int page;

    /**
     * 每页行数
     */
    private int pageSize;

    /**
     * 总页数
     */
    private int totalPages;

    /**
     * 文件总行数
     */
    private int totalLines;

    /**
     * 当前页起始行号（从1开始）
     */
    private int startLine;

    /**
     * 当前页结束行号（包含）
     */
    private int endLine;

    /**
     * 当前页的行内容列表
     */
    private List<String> lines;

    /**
     * 是否有下一页
     */
    private boolean hasNext;

    /**
     * 是否有上一页
     */
    private boolean hasPrev;

    /**
     * 文件版本标识（用于缓存控制）
     */
    private String fileVersion;

    /**
     * 是否为压缩包内的文件
     */
    private boolean isZipEntry;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getTotalLines() {
        return totalLines;
    }

    public void setTotalLines(int totalLines) {
        this.totalLines = totalLines;
    }

    public int getStartLine() {
        return startLine;
    }

    public void setStartLine(int startLine) {
        this.startLine = startLine;
    }

    public int getEndLine() {
        return endLine;
    }

    public void setEndLine(int endLine) {
        this.endLine = endLine;
    }

    public List<String> getLines() {
        return lines;
    }

    public void setLines(List<String> lines) {
        this.lines = lines;
    }

    public boolean isHasNext() {
        return hasNext;
    }

    public void setHasNext(boolean hasNext) {
        this.hasNext = hasNext;
    }

    public boolean isHasPrev() {
        return hasPrev;
    }

    public void setHasPrev(boolean hasPrev) {
        this.hasPrev = hasPrev;
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
}
