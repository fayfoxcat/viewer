/**
 * UI状态管理模块
 * 负责管理界面各部分的显示状态和交互
 */
window.FileLensUIState = (function () {
    'use strict';

    /**
     * 设置空提示的可见性
     * 控制"请选择文件"提示的显示/隐藏
     *
     * @param {boolean} visible - 是否显示空提示
     */
    function setEmptyHintVisible(visible) {
        if (visible) {
            $("#content-empty").show();
            $("#content-actual").hide().empty();
        } else {
            $("#content-empty").hide();
            $("#content-actual").show();
        }
    }

    /**
     * 设置当前活动文件名
     * 更新顶部显示的当前文件路径
     *
     * @param {string|null} name - 文件名或路径，null 表示未选择
     */
    function setActiveFileName(name) {
        const $pathValue = $("#current-file-path");
        if (name && name !== "未选择文件" && name !== null) {
            $pathValue.text(name).removeClass("placeholder");
        } else {
            $pathValue.text("请选择文件").addClass("placeholder");
        }
    }

    /**
     * 获取当前活动文件名
     *
     * @returns {string|null} 当前文件名或路径，未选择时返回 null
     */
    function getActiveFileName() {
        const $pathValue = $("#current-file-path");
        const text = $pathValue.text();
        if (text === "请选择文件" || $pathValue.hasClass("placeholder")) {
            return null;
        }
        return text;
    }

    /**
     * 更新下载按钮状态
     * 根据选中文件数量更新按钮状态和徽章显示
     *
     * @param {Set<string>} selectedIds - 选中的文件 ID 集合
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
     * 打开搜索结果面板
     * 展开右侧搜索结果区域
     */
    function openSearchPanel() {
        $("#main-row").removeClass("right-collapsed");
    }

    /**
     * 关闭搜索结果面板
     * 折叠右侧搜索结果区域
     */
    function closeSearchPanel() {
        $("#main-row").addClass("right-collapsed");
    }

    /**
     * 切换侧边栏显示状态
     * 展开/折叠左侧文件目录区域
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

    return {
        setEmptyHintVisible,
        setActiveFileName,
        getActiveFileName,
        updateDownloadButton,
        openSearchPanel,
        closeSearchPanel,
        toggleSidebar
    };
})();
