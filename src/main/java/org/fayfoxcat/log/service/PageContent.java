package org.fayfoxcat.log.service;

import java.util.List;

/**
 * 分页内容实体类
 * 用于封装文件分页读取的结果
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class PageContent {
    private boolean success;
    private int page;
    private int pageSize;
    private int totalPages;
    private int totalLines;
    private int startLine;
    private int endLine;
    private List<String> lines;
    private boolean hasNext;
    private boolean hasPrev;
    private String fileVersion;
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
