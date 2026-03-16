/**
 * 【内容管理区】工具栏模块
 * 负责搜索、分页按钮、滚动、实时刷新等工具栏交互
 */
window.LogViewerToolbar = (function () {
    'use strict';

    let refreshTimer = null;

    /**
     * 统一的分页按钮处理
     * 支持首页、上一页、下一页、末页操作
     *
     * @param {string} action - 操作类型：'first', 'prev', 'next', 'last'
     * @param {Object} appContext - 应用上下文对象
     * @param {Function} appContext.getActiveId - 获取当前活动文件ID
     * @param {Function} appContext.loadPage - 加载指定页面
     */
    async function handlePaginationClick(action, appContext) {
        if (!appContext.getActiveId()) return;

        const currentPage = window.LogViewerPagination.getCurrentPage();
        const totalPages = window.LogViewerPagination.getTotalPages();
        let targetPage = currentPage;

        switch (action) {
            case 'first':
                if (currentPage <= 1) return;
                targetPage = 1;
                break;
            case 'prev':
                if (currentPage <= 1) return;
                targetPage = currentPage - 1;
                break;
            case 'next':
                if (currentPage >= totalPages) return;
                targetPage = currentPage + 1;
                break;
            case 'last':
                if (currentPage >= totalPages) return;
                targetPage = totalPages;
                break;
            default:
                return;
        }

        await appContext.loadPage(targetPage);
        window.LogViewerContentRenderer.showPageIndicator(targetPage);
    }

    /**
     * 统一的滚动处理
     * 支持滚动到顶部和底部，自动处理分页跳转
     *
     * @param {string} action - 操作类型：'top' 或 'bottom'
     * @param {Object} appContext - 应用上下文对象
     */
    async function handleScrollAction(action, appContext) {
        if (!appContext.getActiveId()) return;

        const currentPage = window.LogViewerPagination.getCurrentPage();
        const totalPages = window.LogViewerPagination.getTotalPages();

        if (action === 'top') {
            if (currentPage !== 1) {
                await appContext.loadPage(1);
            }
            window.LogViewerContentRenderer.scrollToTop();
        } else if (action === 'bottom') {
            if (currentPage !== totalPages) {
                await appContext.loadPage(totalPages);
            }
            window.LogViewerContentRenderer.scrollToBottom();
        }
    }

    /**
     * 执行内容搜索
     * 支持正则表达式和普通文本搜索，调用服务端高级搜索接口
     *
     * @param {boolean} openPanel - 是否打开搜索结果面板
     * @param {Object} appContext - 应用上下文对象
     * @returns {Promise<Object>} 搜索结果对象
     * @throws {Error} 搜索失败时抛出错误
     */
    async function performContentSearch(openPanel, appContext) {
        const keyword = $("#content-search").val().trim();
        const useRegex = $("#use-regex").is(":checked");

        if (!appContext.getActiveId() || !keyword) {
            window.LogViewerSearch.clearSearchResults();
            return;
        }

        try {
            if (openPanel !== false) {
                window.LogViewerUIState.openSearchPanel();
                $("#search-results-list").html(`
                    <div class="text-center p-3">
                        <div class="loading-spinner" style="width: 24px; height: 24px; margin: 0 auto 8px;"></div>
                        <div>搜索中...</div>
                    </div>
                `);
            }

            const response = await fetch(`${window.LogViewerUtils.getEndpoint()}/file/search/advanced`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filePath: appContext.getActiveId(),
                    keyword: keyword,
                    useRegex: useRegex,
                    caseSensitive: false,
                    contextLines: 0,
                    maxResults: 10000
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            if (!result.success) throw new Error(result.error || '搜索失败');

            window.LogViewerSearch.setServerSearchResults(result);
            window.LogViewerSearch.renderSearchResults();

            if (openPanel !== false) {
                window.LogViewerUIState.openSearchPanel();
            }

            return result;

        } catch (error) {
            console.error('搜索失败:', error);
            $("#search-results-list").html(`
                <div class="text-center text-danger p-3">
                    <div>搜索失败</div>
                    <div style="font-size: 12px; margin-top: 8px;">${error.message}</div>
                </div>
            `);
            throw error;
        }
    }

    /**
     * 启动/停止实时刷新
     * 自动跳转到最后一页并定时刷新内容
     *
     * @param {Object} appContext - 应用上下文对象
     */
    async function toggleAutoRefresh(appContext) {
        const $btn = $("#refresh-btn");

        if ($btn.prop("disabled") || $btn.hasClass("disabled")) return;

        const $icon = $btn.find('.refresh-btn-icon');
        const $text = $btn.find('.refresh-btn-text');
        const $loading = $btn.find('.refresh-btn-loading');

        if (refreshTimer) {
            // 停止刷新
            clearInterval(refreshTimer);
            refreshTimer = null;

            $btn.removeClass("refreshing");
            $icon.show();
            $text.text("实时刷新");
            $loading.hide();

            window.LogViewerPagination.setAutoRefreshEnabled(false);
            $("#scroll-top-btn, #scroll-bottom-btn, #page-jump-input").prop("disabled", false).css("cursor", "").removeClass("disabled");
            return;
        }

        if (!appContext.getActiveId()) {
            alert('请先选择一个文件');
            return;
        }

        try {
            const metadata = window.LogViewerPageCache.getStatus().metadata;
            const lastPage = metadata.totalPages;
            await appContext.loadPage(lastPage, true);

            $btn.addClass("refreshing");
            $icon.hide();
            $text.text("停止刷新");
            $loading.show();

            window.LogViewerPagination.setAutoRefreshEnabled(true);
            $("#scroll-top-btn, #scroll-bottom-btn, #page-jump-input").prop("disabled", true).css("cursor", "not-allowed").addClass("disabled");

            refreshTimer = setInterval(async function () {
                if (!appContext.getActiveId()) {
                    console.warn('文件ID丢失，停止刷新');
                    $btn.trigger('click');
                    return;
                }

                try {
                    const metadata = window.LogViewerPageCache.getStatus().metadata;
                    const lastPage = metadata.totalPages;
                    await appContext.loadPage(lastPage, true);
                } catch (error) {
                    console.error('[Refresh] 刷新跳转失败:', error);
                }
            }, 500);

        } catch (error) {
            console.error('启动实时刷新失败:', error);
            alert('启动实时刷新失败: ' + error.message);
        }
    }

    /**
     * 停止刷新（外部调用）
     * 如果正在刷新，则触发停止操作
     */
    function stopRefresh() {
        if (refreshTimer) {
            $("#refresh-btn").trigger('click');
        }
    }

    /**
     * 清理资源
     * 清除定时器，释放资源
     */
    function cleanup() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    return {
        handlePaginationClick,
        handleScrollAction,
        performContentSearch,
        toggleAutoRefresh,
        stopRefresh,
        cleanup
    };
})();
