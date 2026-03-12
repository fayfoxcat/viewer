window.LogViewerPagination = (function() {
    'use strict';

    let currentPage = 1;
    let totalPages = 1;
    const LINES_PER_PAGE = 1000;
    let isAutoRefreshEnabled = false; // 新增：标记是否处于实时刷新状态

    /**
     * 设置实时刷新状态
     */
    function setAutoRefreshEnabled(enabled) {
        isAutoRefreshEnabled = enabled;
    }

    /**
     * 更新分页控件
     */
    function updatePagination(totalLines) {
        totalPages = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        $("#total-lines").text(totalLines);
        $("#page-total-count").text(totalPages);
        $("#page-jump-input").val(currentPage);
        $("#page-jump-input").attr("max", totalPages);

        if (totalLines > LINES_PER_PAGE) {
            $("#pagination-controls").show();
        } else {
            $("#pagination-controls").hide();
        }

        // 根据实时刷新状态更新按钮
        if (isAutoRefreshEnabled) {
            // 实时刷新期间：禁用所有分页按钮
            $("#page-first-btn, #page-prev-btn, #page-next-btn, #page-last-btn").prop("disabled", true);
        } else {
            // 正常状态：根据页码更新按钮状态
            $("#page-first-btn, #page-prev-btn").prop("disabled", currentPage <= 1);
            $("#page-last-btn, #page-next-btn").prop("disabled", currentPage >= totalPages);
        }
    }

    /**
     * 跳转到指定页面
     */
    function goToPage(page) {
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;
        return currentPage;
    }

    /**
     * 获取当前页码
     */
    function getCurrentPage() {
        return currentPage;
    }

    /**
     * 获取总页数
     */
    function getTotalPages() {
        return totalPages;
    }

    /**
     * 重置分页状态
     */
    function reset() {
        currentPage = 1;
        totalPages = 1;
        isAutoRefreshEnabled = false; // 重置实时刷新状态
    }

    /**
     * 设置当前页码
     */
    function setCurrentPage(page) {
        currentPage = page;
    }

    // 公开接口
    return {
        updatePagination,
        goToPage,
        getCurrentPage,
        getTotalPages,
        reset,
        setCurrentPage,
        setAutoRefreshEnabled, // 新增：暴露设置实时刷新状态的方法
        LINES_PER_PAGE
    };
})();