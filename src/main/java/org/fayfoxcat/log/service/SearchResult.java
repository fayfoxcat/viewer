package org.fayfoxcat.log.service;

import java.util.List;

/**
 * 搜索结果实体类
 * 用于封装文件内容搜索的结果
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class SearchResult {
    private boolean success;
    private String keyword;
    private int totalMatches;
    private int returnedMatches;
    private boolean truncated;
    private long searchTime;
    private List<MatchInfo> matches;
    private String fileVersion;
    private String error;

    /**
     * 匹配信息内部类
     */
    public static class MatchInfo {
        private int lineNumber;
        private String content;
        private List<MatchRange> matchRanges;
        private int page;
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
        private int start;
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
        private List<String> before;
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
