/**
 * UI状态管理模块
 */
window.LogViewerUIState = (function() {
    'use strict';

    /**
     * 设置空内容提示的可见性
     * @param {boolean} visible 是否可见
     */
    function setEmptyHintVisible(visible) {
        if (visible) {
            $("#log-content-empty").show();
            $("#log-content-actual").hide().empty();
        } else {
            $("#log-content-empty").hide();
            $("#log-content-actual").show();
        }
    }

    /**
     * 设置当前活动文件名显示
     * @param {string} name 文件名
     */
    function setActiveFileName(name) {
        const $pathValue = $("#current-file-path");
        if (name && name !== "未选择文件" && name !== null) {
            $pathValue.text(name).removeClass("placeholder");
        } else {
            $pathValue.text("请选择日志文件").addClass("placeholder");
        }
    }

    /**
     * 更新下载按钮状态
     * @param {Set} selectedIds 选中的文件ID集合
     */
    function updateDownloadButton(selectedIds) {
        $("#download-btn").prop("disabled", selectedIds.size === 0);
        const badge = $("#selected-count");
        if (selectedIds.size > 0) {
            badge.text(String(selectedIds.size)).show();
        } else {
            badge.hide();
        }
    }

    /**
     * 打开搜索面板
     */
    function openSearchPanel() {
        $("#main-row").removeClass("right-collapsed");
    }

    /**
     * 关闭搜索面板
     */
    function closeSearchPanel() {
        $("#main-row").addClass("right-collapsed");
    }

    /**
     * 切换侧边栏
     */
    function toggleSidebar() {
        const main = $("#main-row");
        const toggleBtn = $("#toggle-sidebar");
        if (main.hasClass("left-collapsed")) {
            main.removeClass("left-collapsed");
            toggleBtn.text("◀");
        } else {
            main.addClass("left-collapsed");
            toggleBtn.text("▶");
        }
    }

    // 公开接口
    return {
        setEmptyHintVisible,
        setActiveFileName,
        updateDownloadButton,
        openSearchPanel,
        closeSearchPanel,
        toggleSidebar
    };
})();