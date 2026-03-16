package org.fayfoxcat.viewer.entity;

import java.util.List;

/**
 * 搜索结果实体类
 * 用于封装文件内容搜索的结果
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class SearchResult {
    /**
     * 搜索操作是否成功
     */
    private boolean success;

    /**
     * 搜索关键词
     */
    private String keyword;

    /**
     * 总匹配数量
     */
    private int totalMatches;

    /**
     * 实际返回的匹配数量（可能因限制而小于总匹配数）
     */
    private int returnedMatches;

    /**
     * 结果是否被截断（超过最大返回数量限制）
     */
    private boolean truncated;

    /**
     * 搜索耗时（毫秒）
     */
    private long searchTime;

    /**
     * 匹配结果列表
     */
    private List<MatchInfo> matches;

    /**
     * 文件版本标识（用于缓存控制）
     */
    private String fileVersion;

    /**
     * 错误信息（当 success=false 时）
     */
    private String error;

    /**
     * 匹配信息内部类
     */
    public static class MatchInfo {
        /**
         * 匹配行的行号（从1开始）
         */
        private int lineNumber;

        /**
         * 匹配行的完整内容
         */
        private String content;

        /**
         * 该行内所有匹配位置的范围列表
         */
        private List<MatchRange> matchRanges;

        /**
         * 该行所在的页码（用于分页显示）
         */
        private int page;

        /**
         * 上下文信息（匹配行前后的内容）
         */
        private ContextInfo context;

        public int getLineNumber() {
            return lineNumber;
        }

        public void setLineNumber(int lineNumber) {
            this.lineNumber = lineNumber;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public List<MatchRange> getMatchRanges() {
            return matchRanges;
        }

        public void setMatchRanges(List<MatchRange> matchRanges) {
            this.matchRanges = matchRanges;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public ContextInfo getContext() {
            return context;
        }

        public void setContext(ContextInfo context) {
            this.context = context;
        }
    }

    /**
     * 匹配范围内部类
     */
    public static class MatchRange {
        /**
         * 匹配开始位置（字符索引，从0开始）
         */
        private int start;

        /**
         * 匹配结束位置（字符索引，不包含）
         */
        private int end;

        public MatchRange() {
        }

        public MatchRange(int start, int end) {
            this.start = start;
            this.end = end;
        }

        public int getStart() {
            return start;
        }

        public void setStart(int start) {
            this.start = start;
        }

        public int getEnd() {
            return end;
        }

        public void setEnd(int end) {
            this.end = end;
        }
    }

    /**
     * 上下文信息内部类
     */
    public static class ContextInfo {
        /**
         * 匹配行之前的行内容列表
         */
        private List<String> before;

        /**
         * 匹配行之后的行内容列表
         */
        private List<String> after;

        public List<String> getBefore() {
            return before;
        }

        public void setBefore(List<String> before) {
            this.before = before;
        }

        public List<String> getAfter() {
            return after;
        }

        public void setAfter(List<String> after) {
            this.after = after;
        }
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public int getTotalMatches() {
        return totalMatches;
    }

    public void setTotalMatches(int totalMatches) {
        this.totalMatches = totalMatches;
    }

    public int getReturnedMatches() {
        return returnedMatches;
    }

    public void setReturnedMatches(int returnedMatches) {
        this.returnedMatches = returnedMatches;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }

    public long getSearchTime() {
        return searchTime;
    }

    public void setSearchTime(long searchTime) {
        this.searchTime = searchTime;
    }

    public List<MatchInfo> getMatches() {
        return matches;
    }

    public void setMatches(List<MatchInfo> matches) {
        this.matches = matches;
    }

    public String getFileVersion() {
        return fileVersion;
    }

    public void setFileVersion(String fileVersion) {
        this.fileVersion = fileVersion;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
