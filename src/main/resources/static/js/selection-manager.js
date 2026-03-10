/**
 * 选择管理模块
 */
window.LogViewerSelectionManager = (function() {
    'use strict';

    let selectedIds = new Set();
    let lastAnchorIndex = -1;

    /**
     * 获取可见的可选择列表项
     */
    function getVisibleSelectableLis() {
        return $("#file-list").find("li.file-node.selectable:visible");
    }

    /**
     * 设置列表项选中状态
     */
    function setLiSelected($li, selected) {
        if (selected) $li.addClass("selected");
        else $li.removeClass("selected");
    }

    /**
     * 切换选择状态
     */
    function toggleSelectionById(id) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        window.LogViewerUIState.updateDownloadButton(selectedIds);
    }

    /**
     * 清空所有选择
     */
    function clearAllSelection() {
        selectedIds.clear();
        $("#file-list li.file-node").removeClass("selected");
        window.LogViewerUIState.updateDownloadButton(selectedIds);
    }

    /**
     * 处理选择点击事件
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
            return;
        }
    }

    /**
     * 获取选中的ID集合
     */
    function getSelectedIds() {
        return selectedIds;
    }

    /**
     * 设置选中的ID集合
     */
    function setSelectedIds(ids) {
        selectedIds = ids;
    }

    // 公开接口
    return {
        getVisibleSelectableLis,
        setLiSelected,
        toggleSelectionById,
        clearAllSelection,
        handleSelectionClick,
        getSelectedIds,
        setSelectedIds
    };
})();