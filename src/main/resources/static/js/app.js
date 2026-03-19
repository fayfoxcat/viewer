/**
 * 主入口协调器
 * 协调【目录区】【内容管理区】【内容区】【搜索结果区】四个区域
 */
$(document).ready(function () {
    'use strict';

    const apiBase = window.location.pathname.replace(/\/$/, "");
    
    // 设置全局 endpoint，供其他模块使用
    window.viewerEndpoint = apiBase;

    if (!window.ViewerAuth.init(apiBase)) {
        return;
    }

    let currentRootPath = $("#path-select").val();
    let activeId = null;
    let currentFileMetadata = null;
    let searchTimer = null;
    let loadPageRequestId = 0;
    let loadPageDebounceTimer = null;
    let isLoadingPage = false; // 全局加载锁，防止并发加载

    // ========== 初始化各区域模块 ==========
    window.ViewerFileTree.init(apiBase);
    window.ViewerFileOperations.init(apiBase);
    window.ViewerContextMenu.init();

    // 暴露给其他模块的上下文接口
    const appContext = {
        getActiveId: () => activeId,
        loadPage: loadPage
    };

    window.ViewerApp = {
        onFileModified: handleFileModified,
        refreshCurrentPage: refreshCurrentPage,
        handlePageChange: handlePageChange
    };

    // ========== 文件事件回调 ==========

    /**
     * 处理文件修改事件
     * 显示文件已修改通知并刷新当前页面
     *
     * @param {Object} _info - 文件变更信息（未使用，保留以匹配接口）
     */
    function handleFileModified(_info) {
        window.ViewerNotification.showFileModified();
        setTimeout(() => refreshCurrentPage(), 500);
    }

    /**
     * 刷新当前页面内容
     * 重新加载当前页的数据
     */
    async function refreshCurrentPage() {
        if (!activeId) return;
        
        // 如果正在加载页面，跳过本次刷新
        if (isLoadingPage) {
            return;
        }
        
        try {
            isLoadingPage = true;
            const currentPage = window.ViewerPagination.getCurrentPage();
            const data = await window.ViewerPageCache.getPage(currentPage);
            
            // 请求被取消，不做任何处理
            if (data === null) {
                return;
            }
            
            window.ViewerContentRenderer.renderLogContent(data.lines, null, 1, data.startLine);
            window.ViewerPagination.updatePagination(data.totalLines);
        } catch (error) {
            console.error('[App] Refresh page error:', error);
        } finally {
            isLoadingPage = false;
        }
    }

    // ========== 页面加载 ==========

    /**
     * 加载指定页面的内容
     * 支持搜索高亮和自动滚动功能
     * 使用防抖机制避免快速点击时发送过多请求
     *
     * @param {number} page - 页码（从1开始）
     * @param {boolean} [autoScroll=false] - 是否自动滚动到底部
     */
    async function loadPage(page, autoScroll = false) {
        // 立即更新页码显示，给用户即时反馈
        window.ViewerPagination.setCurrentPage(page);
        // 只在非自动滚动时显示页码指示器（避免实时刷新时一直显示）
        if (!autoScroll) {
            window.ViewerContentRenderer.showPageIndicator(page);
        }

        // 自动刷新模式：立即执行，不使用防抖
        if (autoScroll) {
            await loadPageImmediate(page, autoScroll);
            return;
        }

        // 清除之前的防抖定时器
        if (loadPageDebounceTimer) {
            clearTimeout(loadPageDebounceTimer);
        }

        // 设置新的防抖定时器，150ms 后执行实际加载
        loadPageDebounceTimer = setTimeout(async () => {
            await loadPageImmediate(page, autoScroll);
        }, 150);
    }

    /**
     * 立即加载页面内容（内部方法）
     * 实际执行页面加载逻辑
     *
     * @param {number} page - 页码（从1开始）
     * @param {boolean} [autoScroll=false] - 是否自动滚动到底部
     */
    async function loadPageImmediate(page, autoScroll = false) {
        // 如果正在加载页面，跳过本次加载（避免并发）
        if (isLoadingPage) {
            return;
        }
        
        // 生成新的请求ID
        const requestId = ++loadPageRequestId;

        try {
            isLoadingPage = true;
            window.ViewerContentRenderer.showLoading();

            const data = await window.ViewerPageCache.getPage(page);

            // 请求被取消，不做任何处理
            if (data === null) {
                window.ViewerContentRenderer.hideLoading();
                return;
            }

            // 检查是否是最新的请求，如果不是则丢弃结果
            if (requestId !== loadPageRequestId) {
                return;
            }

            window.ViewerPageCache.setCurrentPage(page);

            const matches = window.ViewerSearch.getCurrentMatches();
            let highlightMap = null;
            if (matches.length > 0) {
                highlightMap = new Map();
                matches.forEach(match => {
                    if (match.page === page && match.ranges) {
                        const ranges = match.ranges.map(r => ({s: r.start, e: r.end}));
                        highlightMap.set(match.lineNumber, ranges);
                    }
                });
            }

            window.ViewerContentRenderer.renderLogContent(data.lines, highlightMap, 1, data.startLine);
            window.ViewerPagination.updatePagination(data.totalLines);
            window.ViewerUIState.setEmptyHintVisible(false);
            window.ViewerContentRenderer.hideLoading();

            if (autoScroll) {
                window.ViewerContentRenderer.scrollToBottom(true);
            }
        } catch (error) {
            // 只有最新的请求才显示错误
            if (requestId === loadPageRequestId) {
                console.error('[App] Load page error:', error);
                onFileLoadError('加载失败: ' + error.message);
            }
        } finally {
            isLoadingPage = false;
        }
    }

    // ========== 文件加载回调 ==========


    /**
     * 文件加载成功回调
     * 处理文件的分页加载和元数据初始化
     *
     * @param {Object} metadata - 文件元数据
     * @param {number} metadata.totalLines - 文件总行数
     * @param {number} metadata.totalPages - 总页数
     * @param {boolean} metadata.isZipEntry - 是否为压缩包内文件
     * @param {string} fileId - 文件标识符
     */
    async function onFileLoadSuccess(metadata, fileId) {
        activeId = fileId;
        currentFileMetadata = metadata;
        window.ViewerUIState.setActiveFileName(fileId);

        // 清除之前文件的标记
        if (window.ViewerContextMenu) {
            window.ViewerContextMenu.clearMarks();
        }

        const $refreshBtn = $("#refresh-btn");
        if (metadata.zipEntry || metadata.isZipEntry) {
            $refreshBtn.prop("disabled", true).addClass("disabled").attr("title", "压缩包文件不支持实时刷新").css("cursor", "not-allowed");
        } else {
            $refreshBtn.prop("disabled", false).removeClass("disabled").removeAttr("title").css("cursor", "");
        }

        window.ViewerSearch.clearSearchResults();
        $("#content-search").val("");
        window.ViewerPageCache.init(fileId, metadata);
        await loadPage(1);
    }

    /**
     * 文件加载失败回调
     * 显示错误信息并隐藏加载动画
     *
     * @param {string} message - 错误信息
     */
    function onFileLoadError(message) {
        window.ViewerContentRenderer.hideLoading();
        $("#content-actual").html(`<div class="text-center text-danger p-5">${message}</div>`);
        $("#content-actual").show();
    }

    // ========== 页面切换 ==========

    /**
     * 处理页面切换
     * 支持页面跳转和滚动位置恢复
     *
     * @param {number} targetPage - 目标页码
     * @param {number} [lineNumber] - 可选的目标行号
     * @param {number} [scrollPosition] - 可选的滚动位置
     */
    async function handlePageChange(targetPage, lineNumber, scrollPosition) {
        await loadPage(targetPage);
        if (scrollPosition) {
            window.ViewerContentRenderer.scrollToPosition(scrollPosition);
        } else if (lineNumber) {
            setTimeout(() => window.ViewerContentRenderer.scrollToLine(lineNumber), 50);
        }
    }

    // ========== 【目录区】事件绑定 ==========

    $(document).on("click", ".sort-btn", function () {
        window.ViewerFileTree.setSortBy($(this).data("sort"), $(this).data("order"));
        window.ViewerFileTree.renderRootTree(currentRootPath);
    });

    $("#file-search").on("input", function () {
        const keyword = $(this).val().trim();
        if (searchTimer) clearTimeout(searchTimer);

        if (!keyword) {
            window.ViewerFileTree.renderRootTree(currentRootPath);
            return;
        }

        searchTimer = setTimeout(function () {
            $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 搜索中...</li>`);

            window.ViewerFileOperations.searchFiles(currentRootPath, keyword,
                function (data) {
                    $("#file-list").empty();
                    const list = Array.isArray(data) ? data.slice() : [];
                    list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));

                    if (!list.length) {
                        $("#file-list").append(`<li class="text-center text-muted">未找到文件</li>`);
                        return;
                    }

                    list.forEach(function (f) {
                        /** @type {{name?: string, path?: string, size?: number, lastModified?: number, directory?: boolean}} */
                        const file = f || {};
                        const isArchive = window.ViewerUtils.isArchiveFileName(file.name || "");
                        const $li = $("<li class='file-node selectable'>");
                        $li.attr("data-id", file.path).data("node", file);

                        const selectedIds = window.ViewerSelectionManager.getSelectedIds();
                        if (selectedIds.has(file.path || "")) $li.addClass("selected");
                        if (isArchive) $li.addClass("zip-file");

                        $li.html(`
                          <div class="file-row" title="修改时间: ${window.ViewerUtils.formatDate(file.lastModified || 0)}">
                            <div class="file-col file-col-name">
                              ${isArchive ? '<button type="button" class="file-expander" data-expander="1">▸</button>' : '<span class="file-expander hidden">▸</span>'}
                              <span class="file-icon">${isArchive ? "📦" : "📄"}</span>
                              <span class="file-label">${window.ViewerUtils.escapeHtml(file.name || "")}</span>
                            </div>
                            <div class="file-col file-col-time">${window.ViewerUtils.formatDateShort(file.lastModified || 0)}</div>
                            <div class="file-col file-col-size">${window.ViewerUtils.formatFileSize(file.size || 0)}</div>
                          </div>
                        `);

                        if (isArchive) {
                            $li.append($("<ul class='file-list tree-children' style='display:none;'></ul>"));
                        }
                        $("#file-list").append($li);
                    });
                },
                function (xhr, status, error) {
                    console.error('文件搜索失败:', error);
                    $("#file-list").html(`<li class="text-center text-danger">搜索失败: ${error}</li>`);
                }
            );
        }, 250);
    });

    $("#clear-search-btn").on("click", function () {
        $("#file-search").val("");
        window.ViewerFileTree.renderRootTree(currentRootPath);
    });

    $(document).on("click", "#file-list .file-col-name", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!(node.directory);
        const isArchive = !isDir && window.ViewerUtils.isArchiveFileName(node.name || "");
        const isZipEntry = $li.hasClass("zip-entry");

        if (isDir && !isZipEntry) {
            window.ViewerFileTree.expandDirectoryNode($li, node.path);
        } else if (isZipEntry && isDir) {
            window.ViewerFileTree.expandZipDirNode($li);
        } else if (isArchive) {
            window.ViewerFileTree.expandArchiveNode($li, node.path);
        } else {
            $li.trigger("click");
        }
    });

    $(document).on("click", "#file-list .file-col-size", function (e) {
        const $li = $(this).closest("li.file-node");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node");
        if (!node || !!(node.directory)) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.ViewerSelectionManager.handleSelectionClick(e, $li);
        } else {
            $li.trigger("click");
        }
    });

    $(document).on("click", "#file-list .file-expander[data-expander='1']", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node");
        if (!node) return;
        const isDir = !!(node.directory);
        const isArchive = !isDir && window.ViewerUtils.isArchiveFileName(node.name || "");

        if ($li.hasClass("zip-entry") && isDir) {
            window.ViewerFileTree.expandZipDirNode($li);
        } else if (isDir) {
            window.ViewerFileTree.expandDirectoryNode($li, node.path);
        } else if (isArchive) {
            window.ViewerFileTree.expandArchiveNode($li, node.path);
        }
    });

    $(document).on("click", "#file-list li.file-node", function (e) {
        const $li = $(this);
        const id = $li.attr("data-id");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node") || {};
        const isDir = !!(node.directory);
        const isArchive = !isDir && window.ViewerUtils.isArchiveFileName(node.name || "");
        const isZipEntry = $li.hasClass("zip-entry");
        const entryName = $li.attr("data-entry");
        const zipPath = $li.attr("data-zip");

        if (isDir && !isZipEntry) {
            e.stopPropagation();
            window.ViewerFileTree.expandDirectoryNode($li, node.path);
            return;
        }
        if (isZipEntry && isDir) {
            e.stopPropagation();
            window.ViewerFileTree.expandZipDirNode($li);
            return;
        }
        if (isArchive) {
            if (!(e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.stopPropagation();
                window.ViewerFileTree.expandArchiveNode($li, node.path);
            } else {
                e.stopPropagation();
                window.ViewerSelectionManager.handleSelectionClick(e, $li);
            }
            return;
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.ViewerSelectionManager.handleSelectionClick(e, $li);
            return;
        }

        e.stopPropagation();
        $("#file-list li.file-node").removeClass("active");
        $li.addClass("active");

        // 切换文件时停止实时刷新
        window.ViewerToolbar.stopRefresh();

        window.ViewerContentRenderer.showLoading();

        const filePath = isZipEntry ? zipPath + "!" + entryName : node.path;

        $.ajax({
            url: `${apiBase}/file/metadata`,
            method: 'GET',
            data: {file: filePath},
            success: async function (metadata) {
                await onFileLoadSuccess(metadata, filePath);
            },
            error: function (xhr) {
                let errorMessage = '获取文件信息失败';
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr && xhr.status === 500) {
                    errorMessage = '服务器内部错误';
                } else if (xhr && xhr.status === 404) {
                    errorMessage = '文件未找到';
                }
                onFileLoadError(errorMessage);
            }
        });
    });

    $("#download-btn").on("click", function () {
        const selectedIds = window.ViewerSelectionManager.getSelectedIds();
        if (selectedIds.size === 0) {
            alert('请先选择要下载的文件');
            return;
        }
        try {
            window.ViewerFileOperations.downloadSelectedFiles(selectedIds, apiBase);
            window.ViewerSelectionManager.clearAllSelection();
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        }
    });

    // ========== 【内容管理区】事件绑定 ==========

    $("#search-btn").on("click", async function () {
        if (!activeId) {
            window.ViewerUIState.openSearchPanel();
            $("#search-results-list").html(`<div class="text-center text-muted p-3"><div>请先选择一个文件</div></div>`);
            return;
        }
        const keyword = $("#content-search").val().trim();
        if (!keyword) {
            window.ViewerSearch.clearSearchResults();
            return;
        }
        try {
            const result = await window.ViewerToolbar.performContentSearch(true, appContext);
            if (result.matches && result.matches.length > 0) {
                const firstMatch = result.matches[0];
                await loadPage(firstMatch.page);
                setTimeout(() => window.ViewerContentRenderer.scrollToLine(firstMatch.lineNumber), 100);
            }
        } catch (error) {
            console.error('搜索失败:', error);
        }
    });

    $("#use-regex").on("change", function () {
        const $input = $("#content-search");
        if ($(this).is(":checked")) {
            $input.addClass("regex-mode").attr("placeholder", "搜索内容（正则表达式）...");
        } else {
            $input.removeClass("regex-mode").attr("placeholder", "搜索内容（支持正则表达式）...");
        }
    });

    $("#content-search").on("keydown", function (e) {
        const matches = window.ViewerSearch.getCurrentMatches();
        if (!matches.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            window.ViewerSearch.focusMatch(window.ViewerSearch.getNextMatchIndex(), window.ViewerPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            window.ViewerSearch.focusMatch(window.ViewerSearch.getPrevMatchIndex(), window.ViewerPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "Enter") {
            e.preventDefault();
            $("#search-btn").trigger("click");
        }
    });

    $("#scroll-top-btn").on("click", async function () {
        if ($(this).prop("disabled") || $(this).hasClass("disabled")) return;
        await window.ViewerToolbar.handleScrollAction('top', appContext);
    });

    $("#scroll-bottom-btn").on("click", async function () {
        if ($(this).prop("disabled") || $(this).hasClass("disabled")) return;
        await window.ViewerToolbar.handleScrollAction('bottom', appContext);
    });

    $("#page-first-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.ViewerToolbar.handlePaginationClick('first', appContext);
    });
    $("#page-prev-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.ViewerToolbar.handlePaginationClick('prev', appContext);
    });
    $("#page-next-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.ViewerToolbar.handlePaginationClick('next', appContext);
    });
    $("#page-last-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.ViewerToolbar.handlePaginationClick('last', appContext);
    });

    $("#page-jump-input").on("keydown", async function (e) {
        if ($(this).prop("disabled")) return;
        if (e.key === "Enter") {
            const page = parseInt($(this).val(), 10);
            if (isNaN(page) || page < 1) {
                alert('请输入有效的页码');
                return;
            }
            const totalPages = window.ViewerPagination.getTotalPages();
            if (page > totalPages) {
                alert(`页码不能超过总页数 ${totalPages}`);
                return;
            }

            await loadPage(page);
            window.ViewerContentRenderer.showPageIndicator(page);
        }
    });

    $("#refresh-btn").on("click", async function () {
        await window.ViewerToolbar.toggleAutoRefresh(appContext);
    });

    // ========== 【搜索结果区】事件绑定 ==========

    $("#close-search-btn").on("click", function () {
        window.ViewerUIState.closeSearchPanel();
    });

    // ========== 全局事件 ==========

    $("#path-select").on("change", function () {
        const newPath = $(this).val();
        if (newPath === currentRootPath) return;

        window.ViewerToolbar.stopRefresh();
        window.ViewerPageCache.clear();

        currentRootPath = newPath;
        window.ViewerSelectionManager.clearAllSelection();
        window.ViewerFileTree.clearExpandedState();
        activeId = null;
        currentFileMetadata = null;
        window.ViewerSearch.clearSearchResults();
        window.ViewerPagination.reset();
        window.ViewerUIState.setActiveFileName(null);
        window.ViewerUIState.setEmptyHintVisible(true);
        window.ViewerContentRenderer.hideLoading();
        $("#file-search").val("");
        $("#pagination-controls").hide();

        $("#refresh-btn").prop("disabled", false).removeClass("disabled").removeAttr("title").css("cursor", "");
        $("#page-first-btn, #page-prev-btn, #page-next-btn, #page-last-btn, #page-jump-input, #scroll-top-btn, #scroll-bottom-btn").prop("disabled", false).css("cursor", "").removeClass("disabled");

        window.ViewerFileTree.renderRootTree(currentRootPath);
    });

    $("#toggle-sidebar").on("click", function () {
        window.ViewerUIState.toggleSidebar();
    });

    // 拖动调整宽度
    let isResizing = false;
    let currentResizable = null;
    let startX = 0;
    let startWidth = 0;

    $(".resize-handle").on("mousedown", function (e) {
        isResizing = true;
        startX = e.clientX;
        const main = document.getElementById("main-row");
        const cs = getComputedStyle(main);
        if ($(this).parent().attr("id") === "sidebar") {
            currentResizable = "left";
            startWidth = parseFloat(cs.getPropertyValue("--left-width")) || 392;
        }
        e.preventDefault();
        $("body").css("cursor", "col-resize");
    });

    $(document).on("mousemove", function (e) {
        if (!isResizing || !currentResizable) return;
        const main = document.getElementById("main-row");
        const cs = getComputedStyle(main);
        let diff = 0;
        if (currentResizable === "left") diff = e.clientX - startX;
        const newWidth = startWidth + diff;
        if (currentResizable === "left") {
            const minW = parseFloat(cs.getPropertyValue("--left-min")) || 240;
            const maxW = parseFloat(cs.getPropertyValue("--left-max")) || 640;
            main.style.setProperty("--left-width", `${Math.max(minW, Math.min(maxW, newWidth))}px`);
        }
    });

    $(document).on("mouseup", function () {
        if (isResizing) {
            isResizing = false;
            currentResizable = null;
            $("body").css("cursor", "default");
        }
    });

    $(window).on("beforeunload", function () {
        window.ViewerToolbar.cleanup();
        if (searchTimer) clearTimeout(searchTimer);
        if (loadPageDebounceTimer) clearTimeout(loadPageDebounceTimer);
        window.ViewerPageCache.clear();
    });

    // ========== 初始化完成 ==========
    window.ViewerUIState.setEmptyHintVisible(true);
    window.ViewerUIState.updateDownloadButton(window.ViewerSelectionManager.getSelectedIds());
    $("#toggle-sidebar").text($("#main-row").hasClass("left-collapsed") ? "▶" : "◀");
    window.ViewerFileTree.renderRootTree(currentRootPath);
});
