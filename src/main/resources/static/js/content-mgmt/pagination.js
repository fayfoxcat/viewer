/**
 * 【内容管理区】分页控件模块
 * 负责分页状态管理和分页控件的更新
 */
window.ViewerPagination = (function () {
    'use strict';

    let currentPage = 1;
    let totalPages = 1;
    const LINES_PER_PAGE = 1000;
    let isAutoRefreshEnabled = false;

    /**
     * 设置自动刷新状态
     *
     * @param {boolean} enabled - 是否启用自动刷新
     */
    function setAutoRefreshEnabled(enabled) {
        isAutoRefreshEnabled = enabled;
    }

    /**
     * 更新分页控件状态
     * 根据总行数计算总页数并更新 UI
     *
     * @param {number} totalLines - 文件总行数
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

        if (isAutoRefreshEnabled) {
            $("#page-first-btn, #page-prev-btn, #page-next-btn, #page-last-btn").prop("disabled", true);
        } else {
            $("#page-first-btn, #page-prev-btn").prop("disabled", currentPage <= 1);
            $("#page-last-btn, #page-next-btn").prop("disabled", currentPage >= totalPages);
        }
    }

    /**
     * 跳转到指定页面
     * 自动处理边界情况
     *
     * @param {number} page - 目标页码
     * @returns {number} 实际跳转到的页码
     */
    function goToPage(page) {
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;
        return currentPage;
    }

    /**
     * 获取当前页码
     *
     * @returns {number} 当前页码
     */
    function getCurrentPage() {
        return currentPage;
    }

    /**
     * 获取总页数
     *
     * @returns {number} 总页数
     */
    function getTotalPages() {
        return totalPages;
    }

    /**
     * 重置分页状态
     * 将所有状态恢复到初始值
     */
    function reset() {
        currentPage = 1;
        totalPages = 1;
        isAutoRefreshEnabled = false;
    }

    /**
     * 设置当前页码
     *
     * @param {number} page - 页码
     */
    function setCurrentPage(page) {
        currentPage = page;
    }

    return {
        updatePagination,
        getCurrentPage,
        getTotalPages,
        reset,
        setCurrentPage,
        setAutoRefreshEnabled,
        LINES_PER_PAGE
    };
})();
