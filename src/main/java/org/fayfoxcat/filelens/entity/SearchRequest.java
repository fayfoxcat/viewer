package org.fayfoxcat.filelens.entity;

/**
 * 搜索请求实体类
 * 用于封装文件内容搜索的请求参数
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class SearchRequest {
    /**
     * 文件路径（支持压缩包格式：zipPath!entryName）
     */
    private String filePath;

    /**
     * 搜索关键词
     */
    private String keyword;

    /**
     * 是否使用正则表达式
     */
    private boolean useRegex;

    /**
     * 是否区分大小写
     */
    private boolean caseSensitive;

    /**
     * 上下文行数（匹配行前后显示的行数）
     */
    private int contextLines;

    /**
     * 最大结果数（防止返回过多结果）
     */
    private int maxResults;

    /**
     * 预定义模式名称（可选，使用预设的正则模式）
     */
    private String patternName;

    // 构造函数
    public SearchRequest() {
        // 设置默认值
        this.useRegex = false;
        this.caseSensitive = false;
        this.contextLines = 2;
        this.maxResults = 500;
    }

    public SearchRequest(String filePath, String keyword) {
        this();
        this.filePath = filePath;
        this.keyword = keyword;
    }

    // Getter 和 Setter 方法
    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public boolean isUseRegex() {
        return useRegex;
    }

    public void setUseRegex(boolean useRegex) {
        this.useRegex = useRegex;
    }

    public boolean isCaseSensitive() {
        return caseSensitive;
    }

    public void setCaseSensitive(boolean caseSensitive) {
        this.caseSensitive = caseSensitive;
    }

    public int getContextLines() {
        return contextLines;
    }

    public void setContextLines(int contextLines) {
        this.contextLines = contextLines;
    }

    public int getMaxResults() {
        return maxResults;
    }

    public void setMaxResults(int maxResults) {
        this.maxResults = maxResults;
    }

    public String getPatternName() {
        return patternName;
    }

    public void setPatternName(String patternName) {
        this.patternName = patternName;
    }
}