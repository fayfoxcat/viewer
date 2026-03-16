/**
 * 【目录区】选择管理模块
 * 负责文件选择状态的管理，支持单选、多选和范围选择
 */
window.LogViewerSelectionManager = (function () {
    'use strict';

    let selectedIds = new Set();
    let lastAnchorIndex = -1;

    /**
     * 获取可见的可选择列表项
     *
     * @returns {jQuery} 可见的文件节点列表
     */
    function getVisibleSelectableLis() {
        return $("#file-list").find("li.file-node.selectable:visible");
    }

    /**
     * 设置列表项的选中状态
     *
     * @param {jQuery} $li - 列表项元素
     * @param {boolean} selected - 是否选中
     */
    function setLiSelected($li, selected) {
        if (selected) $li.addClass("selected");
        else $li.removeClass("selected");
    }

    /**
     * 切换指定 ID 的选中状态
     *
     * @param {string} id - 文件 ID
     */
    function toggleSelectionById(id) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        window.LogViewerUIState.updateDownloadButton(selectedIds);
    }

    /**
     * 清除所有选择
     * 重置选择状态并更新 UI
     */
    function clearAllSelection() {
        selectedIds.clear();
        $("#file-list li.file-node").removeClass("selected");
        window.LogViewerUIState.updateDownloadButton(selectedIds);
    }

    /**
     * 处理选择点击事件
     * 支持 Ctrl/Cmd 多选和 Shift 范围选择
     *
     * @param {Event} e - 鼠标事件对象
     * @param {jQuery} $li - 被点击的列表项
     */
    function handleSelectionClick(e, $li) {
        const visible = getVisibleSelectableLis();
        const id = $li.attr("data-id");
        if (!$li.hasClass("selectable")) return;

        if (e.ctrlKey || e.metaKey) {
            toggleSelectionById(id);
            setLiSelected($li, selectedIds.has(id));
            lastAnchorIndex = visible.index($li);
            return;
        }

        if (e.shiftKey) {
            const idx = visible.index($li);
            if (lastAnchorIndex < 0) {
                toggleSelectionById(id);
                setLiSelected($li, selectedIds.has(id));
                lastAnchorIndex = idx;
                return;
            }
            const start = Math.min(lastAnchorIndex, idx);
            const end = Math.max(lastAnchorIndex, idx);
            visible.slice(start, end + 1).each(function () {
                const $n = $(this);
                const nid = $n.attr("data-id");
                selectedIds.add(nid);
                setLiSelected($n, true);
            });
            window.LogViewerUIState.updateDownloadButton(selectedIds);
        }
    }

    /**
     * 获取选中的文件 ID 集合
     *
     * @returns {Set<string>} 选中的文件 ID 集合
     */
    function getSelectedIds() {
        return selectedIds;
    }

    return {
        clearAllSelection,
        handleSelectionClick,
        getSelectedIds
    };
})();
