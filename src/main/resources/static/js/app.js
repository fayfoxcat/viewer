/**
 * 主入口协调器
 * 协调【目录区】【内容管理区】【内容区】【搜索结果区】四个区域
 */
$(document).ready(function () {
    'use strict';

    const apiBase = window.location.pathname.replace(/\/$/, "");

    if (!window.FileLensAuth.init(apiBase)) {
        return;
    }

    let currentRootPath = $("#path-select").val();
    let activeId = null;
    let currentFileMetadata = null;
    let searchTimer = null;
    let loadPageRequestId = 0;
    let loadPageDebounceTimer = null;

    // ========== 初始化各区域模块 ==========
    window.FileLensFileTree.init(apiBase);
    window.FileLensFileOperations.init(apiBase);
    window.FileLensContextMenu.init();

    // 暴露给其他模块的上下文接口
    const appContext = {
        getActiveId: () => activeId,
        loadPage: loadPage
    };

    window.FileLensApp = {
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
        window.FileLensNotification.showFileModified();
        setTimeout(() => refreshCurrentPage(), 500);
    }

    /**
     * 刷新当前页面内容
     * 重新加载当前页的数据
     */
    async function refreshCurrentPage() {
        if (!activeId) return;
        try {
            const currentPage = window.FileLensPagination.getCurrentPage();
            const data = await window.FileLensPageCache.getPage(currentPage);
            window.FileLensContentRenderer.renderLogContent(data.lines, null, 1, data.startLine);
            window.FileLensPagination.updatePagination(data.totalLines);
        } catch (error) {
            console.error('[App] Refresh page error:', error);
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
        window.FileLensPagination.setCurrentPage(page);
        // 只在非自动滚动时显示页码指示器（避免实时刷新时一直显示）
        if (!autoScroll) {
            window.FileLensContentRenderer.showPageIndicator(page);
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
        // 生成新的请求ID
        const requestId = ++loadPageRequestId;

        try {
            window.FileLensContentRenderer.showLoading();

            const data = await window.FileLensPageCache.getPage(page);

            // 请求被取消，不做任何处理
            if (data === null) {
                window.FileLensContentRenderer.hideLoading();
                return;
            }

            // 检查是否是最新的请求，如果不是则丢弃结果
            if (requestId !== loadPageRequestId) {
                return;
            }

            window.FileLensPageCache.setCurrentPage(page);

            const matches = window.FileLensSearch.getCurrentMatches();
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

            window.FileLensContentRenderer.renderLogContent(data.lines, highlightMap, 1, data.startLine);
            window.FileLensPagination.updatePagination(data.totalLines);
            window.FileLensUIState.setEmptyHintVisible(false);
            window.FileLensContentRenderer.hideLoading();

            if (autoScroll) {
                window.FileLensContentRenderer.scrollToBottom(true);
            }
        } catch (error) {
            // 只有最新的请求才显示错误
            if (requestId === loadPageRequestId) {
                console.error('[App] Load page error:', error);
                onFileLoadError('加载失败: ' + error.message);
            }
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
        window.FileLensUIState.setActiveFileName(fileId);

        // 清除之前文件的标记
        if (window.FileLensContextMenu) {
            window.FileLensContextMenu.clearMarks();
        }

        const $refreshBtn = $("#refresh-btn");
        if (metadata.zipEntry || metadata.isZipEntry) {
            $refreshBtn.prop("disabled", true).addClass("disabled").attr("title", "压缩包文件不支持实时刷新").css("cursor", "not-allowed");
        } else {
            $refreshBtn.prop("disabled", false).removeClass("disabled").removeAttr("title").css("cursor", "");
        }

        window.FileLensSearch.clearSearchResults();
        $("#content-search").val("");
        window.FileLensPageCache.init(fileId, metadata);
        await loadPage(1);
    }

    /**
     * 文件加载失败回调
     * 显示错误信息并隐藏加载动画
     *
     * @param {string} message - 错误信息
     */
    function onFileLoadError(message) {
        window.FileLensContentRenderer.hideLoading();
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
            window.FileLensContentRenderer.scrollToPosition(scrollPosition);
        } else if (lineNumber) {
            setTimeout(() => window.FileLensContentRenderer.scrollToLine(lineNumber), 50);
        }
    }

    // ========== 【目录区】事件绑定 ==========

    $(document).on("click", ".sort-btn", function () {
        window.FileLensFileTree.setSortBy($(this).data("sort"), $(this).data("order"));
        window.FileLensFileTree.renderRootTree(currentRootPath);
    });

    $("#file-search").on("input", function () {
        const keyword = $(this).val().trim();
        if (searchTimer) clearTimeout(searchTimer);

        if (!keyword) {
            window.FileLensFileTree.renderRootTree(currentRootPath);
            return;
        }

        searchTimer = setTimeout(function () {
            $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 搜索中...</li>`);

            window.FileLensFileOperations.searchFiles(currentRootPath, keyword,
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
                        const isArchive = window.FileLensUtils.isArchiveFileName(file.name || "");
                        const $li = $("<li class='file-node selectable'>");
                        $li.attr("data-id", file.path).data("node", file);

                        const selectedIds = window.FileLensSelectionManager.getSelectedIds();
                        if (selectedIds.has(file.path || "")) $li.addClass("selected");
                        if (isArchive) $li.addClass("zip-file");

                        $li.html(`
                          <div class="file-row" title="修改时间: ${window.FileLensUtils.formatDate(file.lastModified || 0)}">
                            <div class="file-col file-col-name">
                              ${isArchive ? '<button type="button" class="file-expander" data-expander="1">▸</button>' : '<span class="file-expander hidden">▸</span>'}
                              <span class="file-icon">${isArchive ? "📦" : "📄"}</span>
                              <span class="file-label">${window.FileLensUtils.escapeHtml(file.name || "")}</span>
                            </div>
                            <div class="file-col file-col-time">${window.FileLensUtils.formatDateShort(file.lastModified || 0)}</div>
                            <div class="file-col file-col-size">${window.FileLensUtils.formatFileSize(file.size || 0)}</div>
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
        window.FileLensFileTree.renderRootTree(currentRootPath);
    });

    $(document).on("click", "#file-list .file-col-name", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!(node.directory);
        const isArchive = !isDir && window.FileLensUtils.isArchiveFileName(node.name || "");
        const isZipEntry = $li.hasClass("zip-entry");

        if (isDir && !isZipEntry) {
            window.FileLensFileTree.expandDirectoryNode($li, node.path);
        } else if (isZipEntry && isDir) {
            window.FileLensFileTree.expandZipDirNode($li);
        } else if (isArchive) {
            window.FileLensFileTree.expandArchiveNode($li, node.path);
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
            window.FileLensSelectionManager.handleSelectionClick(e, $li);
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
        const isArchive = !isDir && window.FileLensUtils.isArchiveFileName(node.name || "");

        if ($li.hasClass("zip-entry") && isDir) {
            window.FileLensFileTree.expandZipDirNode($li);
        } else if (isDir) {
            window.FileLensFileTree.expandDirectoryNode($li, node.path);
        } else if (isArchive) {
            window.FileLensFileTree.expandArchiveNode($li, node.path);
        }
    });

    $(document).on("click", "#file-list li.file-node", function (e) {
        const $li = $(this);
        const id = $li.attr("data-id");
        /** @type {{directory?: boolean, name?: string, path?: string}} */
        const node = $li.data("node") || {};
        const isDir = !!(node.directory);
        const isArchive = !isDir && window.FileLensUtils.isArchiveFileName(node.name || "");
        const isZipEntry = $li.hasClass("zip-entry");
        const entryName = $li.attr("data-entry");
        const zipPath = $li.attr("data-zip");

        if (isDir && !isZipEntry) {
            e.stopPropagation();
            window.FileLensFileTree.expandDirectoryNode($li, node.path);
            return;
        }
        if (isZipEntry && isDir) {
            e.stopPropagation();
            window.FileLensFileTree.expandZipDirNode($li);
            return;
        }
        if (isArchive) {
            if (!(e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.stopPropagation();
                window.FileLensFileTree.expandArchiveNode($li, node.path);
            } else {
                e.stopPropagation();
                window.FileLensSelectionManager.handleSelectionClick(e, $li);
            }
            return;
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.FileLensSelectionManager.handleSelectionClick(e, $li);
            return;
        }

        e.stopPropagation();
        $("#file-list li.file-node").removeClass("active");
        $li.addClass("active");

        // 切换文件时停止实时刷新
        window.FileLensToolbar.stopRefresh();

        window.FileLensContentRenderer.showLoading();

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
        const selectedIds = window.FileLensSelectionManager.getSelectedIds();
        if (selectedIds.size === 0) {
            alert('请先选择要下载的文件');
            return;
        }
        try {
            window.FileLensFileOperations.downloadSelectedFiles(selectedIds, apiBase);
            window.FileLensSelectionManager.clearAllSelection();
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        }
    });

    // ========== 【内容管理区】事件绑定 ==========

    $("#search-btn").on("click", async function () {
        if (!activeId) {
            window.FileLensUIState.openSearchPanel();
            $("#search-results-list").html(`<div class="text-center text-muted p-3"><div>请先选择一个文件</div></div>`);
            return;
        }
        const keyword = $("#content-search").val().trim();
        if (!keyword) {
            window.FileLensSearch.clearSearchResults();
            return;
        }
        try {
            const result = await window.FileLensToolbar.performContentSearch(true, appContext);
            if (result.matches && result.matches.length > 0) {
                const firstMatch = result.matches[0];
                await loadPage(firstMatch.page);
                setTimeout(() => window.FileLensContentRenderer.scrollToLine(firstMatch.lineNumber), 100);
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
        const matches = window.FileLensSearch.getCurrentMatches();
        if (!matches.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            window.FileLensSearch.focusMatch(window.FileLensSearch.getNextMatchIndex(), window.FileLensPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            window.FileLensSearch.focusMatch(window.FileLensSearch.getPrevMatchIndex(), window.FileLensPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "Enter") {
            e.preventDefault();
            $("#search-btn").trigger("click");
        }
    });

    $("#scroll-top-btn").on("click", async function () {
        if ($(this).prop("disabled") || $(this).hasClass("disabled")) return;
        await window.FileLensToolbar.handleScrollAction('top', appContext);
    });

    $("#scroll-bottom-btn").on("click", async function () {
        if ($(this).prop("disabled") || $(this).hasClass("disabled")) return;
        await window.FileLensToolbar.handleScrollAction('bottom', appContext);
    });

    $("#page-first-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.FileLensToolbar.handlePaginationClick('first', appContext);
    });
    $("#page-prev-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.FileLensToolbar.handlePaginationClick('prev', appContext);
    });
    $("#page-next-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.FileLensToolbar.handlePaginationClick('next', appContext);
    });
    $("#page-last-btn").on("click", async function () {
        if ($(this).prop("disabled")) return;
        await window.FileLensToolbar.handlePaginationClick('last', appContext);
    });

    $("#page-jump-input").on("keydown", async function (e) {
        if ($(this).prop("disabled")) return;
        if (e.key === "Enter") {
            const page = parseInt($(this).val(), 10);
            if (isNaN(page) || page < 1) {
                alert('请输入有效的页码');
                return;
            }
            const totalPages = window.FileLensPagination.getTotalPages();
            if (page > totalPages) {
                alert(`页码不能超过总页数 ${totalPages}`);
                return;
            }

            await loadPage(page);
            window.FileLensContentRenderer.showPageIndicator(page);
        }
    });

    $("#refresh-btn").on("click", async function () {
        await window.FileLensToolbar.toggleAutoRefresh(appContext);
    });

    // ========== 【搜索结果区】事件绑定 ==========

    $("#close-search-btn").on("click", function () {
        window.FileLensUIState.closeSearchPanel();
    });

    // ========== 全局事件 ==========

    $("#path-select").on("change", function () {
        const newPath = $(this).val();
        if (newPath === currentRootPath) return;

        window.FileLensToolbar.stopRefresh();
        window.FileLensPageCache.clear();

        currentRootPath = newPath;
        window.FileLensSelectionManager.clearAllSelection();
        window.FileLensFileTree.clearExpandedState();
        activeId = null;
        currentFileMetadata = null;
        window.FileLensSearch.clearSearchResults();
        window.FileLensPagination.reset();
        window.FileLensUIState.setActiveFileName(null);
        window.FileLensUIState.setEmptyHintVisible(true);
        window.FileLensContentRenderer.hideLoading();
        $("#file-search").val("");
        $("#pagination-controls").hide();

        $("#refresh-btn").prop("disabled", false).removeClass("disabled").removeAttr("title").css("cursor", "");
        $("#page-first-btn, #page-prev-btn, #page-next-btn, #page-last-btn, #page-jump-input, #scroll-top-btn, #scroll-bottom-btn").prop("disabled", false).css("cursor", "").removeClass("disabled");

        window.FileLensFileTree.renderRootTree(currentRootPath);
    });

    $("#toggle-sidebar").on("click", function () {
        window.FileLensUIState.toggleSidebar();
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
        window.FileLensToolbar.cleanup();
        if (searchTimer) clearTimeout(searchTimer);
        if (loadPageDebounceTimer) clearTimeout(loadPageDebounceTimer);
        window.FileLensPageCache.clear();
    });

    // ========== 初始化完成 ==========
    window.FileLensUIState.setEmptyHintVisible(true);
    window.FileLensUIState.updateDownloadButton(window.FileLensSelectionManager.getSelectedIds());
    $("#toggle-sidebar").text($("#main-row").hasClass("left-collapsed") ? "▶" : "◀");
    window.FileLensFileTree.renderRootTree(currentRootPath);
});
