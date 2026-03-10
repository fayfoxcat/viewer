/**
 * 分页管理模块
 */
window.LogViewerPagination = (function() {
    'use strict';

    let currentPage = 1;
    let totalPages = 1;
    const LINES_PER_PAGE = 500;

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
        
        $("#page-first-btn, #page-prev-btn").prop("disabled", currentPage <= 1);
        $("#page-last-btn, #page-next-btn").prop("disabled", currentPage >= totalPages);
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
        LINES_PER_PAGE
    };
})();