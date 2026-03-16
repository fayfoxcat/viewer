/**
 * 【目录区】文件操作模块
 * 负责文件搜索和下载操作
 */
window.ViewerFileOperations = (function () {
    'use strict';

    let apiBase = '';

    /**
     * 搜索文件
     * 在指定根路径下递归搜索文件名
     *
     * @param {string} rootPath - 根路径
     * @param {string} keyword - 搜索关键词
     * @param {Function} onSuccess - 成功回调函数 (data) => void
     * @param {Function} onError - 失败回调函数 (errorMessage) => void
     */
    function searchFiles(rootPath, keyword, onSuccess, onError) {
        $.get(apiBase + "/files/search", {rootPath: rootPath, keyword: keyword}, function (data) {
            if (onSuccess) onSuccess(data);
        }).fail(function () {
            if (onError) onError("搜索失败");
        });
    }

    /**
     * 下载选中的文件
     * 创建表单并提交下载请求
     *
     * @param {Set<string>} selectedIds - 选中的文件 ID 集合
     * @param {string} apiBasePath - API 基础路径
     */
    function downloadSelectedFiles(selectedIds, apiBasePath) {
        if (selectedIds.size === 0) return;
        const form = $(`<form action="${apiBasePath}/download" method="post"></form>`);
        Array.from(selectedIds).forEach(function (id) {
            form.append(`<input type="hidden" name="files" value="${window.ViewerUtils.escapeHtml(id)}"/>`);
        });
        $("body").append(form);
        form.submit();
        form.remove();
    }

    /**
     * 初始化模块
     * 设置 API 基础路径
     *
     * @param {string} apiBasePath - API 基础路径
     */
    function init(apiBasePath) {
        apiBase = apiBasePath;
    }

    return {
        init,
        searchFiles,
        downloadSelectedFiles
    };
})();
