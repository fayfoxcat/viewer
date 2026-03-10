/**
 * 文件操作模块
 */
window.LogViewerFileOperations = (function() {
    'use strict';

    let apiBase = '';

    /**
     * 加载文件系统文件
     */
    function loadFsFile(filePath, onSuccess, onError) {
        $.get(apiBase + "/file/content", { filePath: filePath }, function (data) {
            const lines = String(data || "").split("\n");
            if (onSuccess) onSuccess(lines, filePath);
        }).fail(function () {
            if (onError) onError("加载文件失败");
        });
    }

    /**
     * 加载压缩包内文件
     */
    function loadZipEntry(zipPath, entryName, onSuccess, onError) {
        $.get(apiBase + "/zip/file/content", { zipPath: zipPath, entryName: entryName }, function (data) {
            const lines = String(data || "").split("\n");
            const activeId = zipPath + "!" + entryName;
            if (onSuccess) onSuccess(lines, activeId);
        }).fail(function () {
            if (onError) onError("加载文件失败");
        });
    }

    /**
     * 搜索文件
     */
    function searchFiles(rootPath, keyword, onSuccess, onError) {
        $.get(apiBase + "/files/search", { rootPath: rootPath, keyword: keyword }, function (data) {
            if (onSuccess) onSuccess(data);
        }).fail(function () {
            if (onError) onError("搜索失败");
        });
    }

    /**
     * 下载选中的文件
     */
    function downloadSelectedFiles(selectedIds, apiBasePath) {
        if (selectedIds.size === 0) return;
        const form = $(`<form action="${apiBasePath}/download" method="post"></form>`);
        Array.from(selectedIds).forEach(function (id) {
            form.append(`<input type="hidden" name="files" value="${window.LogViewerUtils.escapeHtml(id)}"/>`);
        });
        $("body").append(form);
        form.submit();
        form.remove();
    }

    /**
     * 初始化模块
     */
    function init(apiBasePath) {
        apiBase = apiBasePath;
    }

    // 公开接口
    return {
        init,
        loadFsFile,
        loadZipEntry,
        searchFiles,
        downloadSelectedFiles
    };
})();