$(document).ready(function () {
    'use strict';

    const apiBase = window.location.pathname.replace(/\/$/, "");
    
    if (!window.LogViewerAuth.init(apiBase)) {
        return;
    }

    let currentRootPath = $("#path-select").val();
    let activeId = null;
    let refreshTimer = null;
    let currentContentLines = [];
    let usePaginationMode = false;
    let currentFileMetadata = null;

    window.LogViewerFileTree.init(apiBase);
    window.LogViewerFileOperations.init(apiBase);

    window.LogViewerApp = {
        onFileAppend: handleFileAppend,
        onFileModified: handleFileModified,
        refreshCurrentPage: refreshCurrentPage,
        handlePageChange: handlePageChange
    };

    /**
     * 处理文件追加事件
     * @param {Object} info 追加信息
     */
    function handleFileAppend(info) {
        window.LogViewerPagination.updatePagination(info.newTotalPages * 1000);
    }

    /**
     * 处理文件修改事件
     * @param {Object} info 修改信息
     */
    function handleFileModified(info) {
        window.LogViewerNotification.showFileModified();
        setTimeout(() => refreshCurrentPage(), 500);
    }

    /**
     * 刷新当前页面内容
     */
    async function refreshCurrentPage() {
        if (!activeId || !usePaginationMode) return;
        
        try {
            const currentPage = window.LogViewerPagination.getCurrentPage();
            const data = await window.LogViewerPageCache.getPage(currentPage);
            
            window.LogViewerContentRenderer.renderLogContent(data.lines, null, 1, data.startLine);
            window.LogViewerPagination.updatePagination(data.totalLines);
            
        } catch (error) {
            console.error('[App] Refresh page error:', error);
        }
    }

    /**
     * 跳转到最后一页
     */
    async function jumpToLastPage() {
        if (!usePaginationMode) return;
        
        try {
            const metadata = window.LogViewerPageCache.getStatus().metadata;
            const lastPage = metadata.totalPages;
            await loadPage(lastPage, true);
        } catch (error) {
            console.error('[App] Jump to last page error:', error);
        }
    }

    /**
     * 加载指定页面内容
     * @param {number} page 页码
     * @param {boolean} autoScroll 是否自动滚动到底部
     */
    async function loadPage(page, autoScroll = false) {
        try {
            window.LogViewerContentRenderer.showLoading();
            
            const data = await window.LogViewerPageCache.getPage(page);
            
            window.LogViewerPagination.setCurrentPage(page);
            window.LogViewerPageCache.setCurrentPage(page);
            
            const matches = window.LogViewerSearch.getCurrentMatches();
            let highlightMap = null;
            
            if (matches.length > 0) {
                highlightMap = new Map();
                matches.forEach(match => {
                    if (match.page === page && match.ranges) {
                        const ranges = match.ranges.map(r => ({ s: r.start, e: r.end }));
                        highlightMap.set(match.lineNumber, ranges);
                    }
                });
            }
            
            window.LogViewerContentRenderer.renderLogContent(data.lines, highlightMap, 1, data.startLine);
            
            window.LogViewerPagination.updatePagination(data.totalLines);
            window.LogViewerUIState.setEmptyHintVisible(false);
            
            window.LogViewerContentRenderer.hideLoading();
            
            if (autoScroll) {
                window.LogViewerContentRenderer.scrollToBottom(true);
            }
            
        } catch (error) {
            console.error('[App] Load page error:', error);
            onFileLoadError('加载失败: ' + error.message);
        }
    }

    /**
     * 文件加载成功回调（传统模式）
     * @param {Array} lines 文件行数组
     * @param {string} fileId 文件ID
     */
    function onFileLoadSuccess(lines, fileId) {
        activeId = fileId;
        window.LogViewerUIState.setActiveFileName(fileId);
        currentContentLines = lines;
        usePaginationMode = false;
        window.LogViewerPagination.reset();
        
        // 清除之前的搜索（如果有）
        window.LogViewerSearch.clearSearchResults();
        $("#content-search").val("");

        const keyword = $("#content-search").val().trim();
        if (keyword) {
            performContentSearch();
        } else {
            window.LogViewerSearch.clearSearchResults();
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, 1);
        }

        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerUIState.setEmptyHintVisible(false);
    }

    /**
     * 文件加载成功回调（分页模式）
     * @param {Object} metadata 文件元数据
     * @param {string} fileId 文件ID
     */
    async function onFileLoadSuccessPaginated(metadata, fileId) {
        activeId = fileId;
        currentFileMetadata = metadata;
        usePaginationMode = true;
        window.LogViewerUIState.setActiveFileName(fileId);
        
        // 清除搜索状态（分页模式不支持搜索）
        window.LogViewerSearch.clearSearchResults();
        $("#content-search").val("");
        
        // 初始化缓存
        window.LogViewerPageCache.init(fileId, metadata);
        
        // 加载第一页
        await loadPage(1);
    }

    /**
     * 文件加载失败回调
     * @param {string} message 错误消息
     */
    function onFileLoadError(message) {
        window.LogViewerContentRenderer.hideLoading();
        $("#log-content-actual").html(`<div class="text-center text-danger p-5">${message}</div>`);
        $("#log-content-actual").show();
    }

    /**
     * 执行内容搜索
     * @param {boolean} openPanel 是否打开搜索面板
     * @returns {Promise<Object>} 搜索结果
     */
    async function performContentSearch(openPanel = false) {
        const keyword = $("#content-search").val().trim();
        const useRegex = $("#use-regex").is(":checked");
        
        if (!activeId || !keyword) {
            window.LogViewerSearch.clearSearchResults();
            if (!usePaginationMode) {
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
            }
            return;
        }

        // 使用服务端搜索（支持分页模式和传统模式）
        try {
            // 在搜索结果面板显示搜索中提示，而不是清空主内容区
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file: activeId,
                    keyword: keyword,
                    useRegex: useRegex,
                    caseSensitive: false,
                    contextLines: 0,
                    maxResults: 10000
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '搜索失败');
            }
            
            // 处理搜索结果
            window.LogViewerSearch.setServerSearchResults(result, usePaginationMode);
            window.LogViewerSearch.renderSearchResults(keyword, useRegex);
            
            if (openPanel !== false) {
                window.LogViewerUIState.openSearchPanel();
            }
            
            return result;
            
        } catch (error) {
            console.error('搜索失败:', error);
            // 在搜索结果面板显示错误，而不是弹框
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
     * 统一的页面跳转处理函数
     * @param {number} targetPage 目标页码
     * @param {number} lineNumber 行号（可选）
     * @param {string} scrollPosition 滚动位置（可选）
     */
    async function handlePageChange(targetPage, lineNumber, scrollPosition) {
        if (usePaginationMode) {
            // 分页模式
            await loadPage(targetPage);
            
            if (scrollPosition) {
                window.LogViewerContentRenderer.scrollToPosition(scrollPosition);
            } else if (lineNumber) {
                setTimeout(() => window.LogViewerContentRenderer.scrollToLine(lineNumber), 50);
            }
        } else {
            // 传统模式
            const newPage = window.LogViewerPagination.goToPage(targetPage);
            
            // 重新执行搜索以生成高亮
            const keyword = $("#content-search").val().trim();
            const useRegex = $("#use-regex").is(":checked");
            
            if (keyword) {
                const result = window.LogViewerSearch.runContentSearch(currentContentLines, keyword, useRegex);
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, result.highlightMap, newPage);
            } else {
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
            }
            
            window.LogViewerPagination.updatePagination(currentContentLines.length);
            
            if (scrollPosition) {
                window.LogViewerContentRenderer.scrollToPosition(scrollPosition);
            } else if (lineNumber) {
                setTimeout(() => window.LogViewerContentRenderer.scrollToLine(lineNumber), 50);
            }
        }
    }

    /**
     * 统一的分页按钮处理函数
     * @param {string} action 操作类型（first/prev/next/last）
     */
    async function handlePaginationClick(action) {
        if (!activeId) return;
        
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
        
        if (usePaginationMode) {
            await loadPage(targetPage);
            window.LogViewerContentRenderer.showPageIndicator(targetPage);
        } else {
            const newPage = window.LogViewerPagination.goToPage(targetPage);
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
            window.LogViewerPagination.updatePagination(currentContentLines.length);
            window.LogViewerContentRenderer.showPageIndicator(newPage);
        }
    }

    /**
     * 统一的滚动处理函数
     * @param {string} action 滚动操作（top/bottom）
     */
    async function handleScrollAction(action) {
        if (!activeId) return;
        
        const currentPage = window.LogViewerPagination.getCurrentPage();
        const totalPages = window.LogViewerPagination.getTotalPages();
        
        if (action === 'top') {
            if (usePaginationMode) {
                if (currentPage !== 1) {
                    await loadPage(1);
                }
                window.LogViewerContentRenderer.scrollToTop();
            } else {
                if (currentPage !== 1) {
                    const newPage = window.LogViewerPagination.goToPage(1);
                    window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
                    window.LogViewerPagination.updatePagination(currentContentLines.length);
                }
                window.LogViewerContentRenderer.scrollToTop();
            }
        } else if (action === 'bottom') {
            if (usePaginationMode) {
                if (currentPage !== totalPages) {
                    await loadPage(totalPages);
                }
                window.LogViewerContentRenderer.scrollToBottom();
            } else {
                if (currentPage !== totalPages) {
                    const newPage = window.LogViewerPagination.goToPage(totalPages);
                    window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
                    window.LogViewerPagination.updatePagination(currentContentLines.length);
                }
                window.LogViewerContentRenderer.scrollToBottom();
            }
        }
    }

    // 排序按钮事件
    $(document).on("click", ".sort-btn", function() {
        const sortBy = $(this).data("sort");
        const sortOrder = $(this).data("order");
        
        window.LogViewerFileTree.setSortBy(sortBy, sortOrder);
        window.LogViewerFileTree.renderRootTree(currentRootPath);
    });

    // 左侧文件搜索 - 防抖处理
    let searchTimer = null;
    $("#file-search").on("input", function () {
        const keyword = $(this).val().trim();

        if (searchTimer) clearTimeout(searchTimer);
        
        if (!keyword) {
            window.LogViewerFileTree.renderRootTree(currentRootPath);
            return;
        }
        
        searchTimer = setTimeout(function () {
            $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 搜索中...</li>`);
            
            window.LogViewerFileOperations.searchFiles(currentRootPath, keyword, 
                function(data) {
                    $("#file-list").empty();
                    const list = Array.isArray(data) ? data.slice() : [];
                    list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
                    
                    if (!list.length) {
                        $("#file-list").append(`<li class="text-center text-muted">未找到文件</li>`);
                        return;
                    }
                    
                    list.forEach(function (f) {
                        const isArchive = window.LogViewerUtils.isArchiveFileName(f.name);
                        const $li = $("<li class='file-node selectable'>");
                        $li.attr("data-id", f.path);
                        $li.data("node", f);
                        
                        const selectedIds = window.LogViewerSelectionManager.getSelectedIds();
                        if (selectedIds.has(f.path)) $li.addClass("selected");
                        if (isArchive) $li.addClass("zip-file");

                        $li.html(`
                          <div class="file-row" title="修改时间: ${window.LogViewerUtils.formatDate(f.lastModified)}">
                            <div class="file-col file-col-name">
                              ${isArchive ? '<button type="button" class="file-expander" data-expander="1">▸</button>' : '<span class="file-expander hidden">▸</span>'}
                              <span class="file-icon">${isArchive ? "📦" : "📄"}</span>
                              <span class="file-label">${window.LogViewerUtils.escapeHtml(f.name)}</span>
                            </div>
                            <div class="file-col file-col-time">${window.LogViewerUtils.formatDateShort(f.lastModified)}</div>
                            <div class="file-col file-col-size">${window.LogViewerUtils.formatFileSize(f.size)}</div>
                          </div>
                        `);
                        
                        if (isArchive) {
                            const $childUl = $("<ul class='file-list tree-children' style='display:none;'></ul>");
                            $li.append($childUl);
                        }
                        
                        $("#file-list").append($li);
                    });
                },
                function(xhr, status, error) {
                    console.error('文件搜索失败:', error);
                    $("#file-list").html(`<li class="text-center text-danger">搜索失败: ${error}</li>`);
                }
            );
        }, 250);
    });

    // 事件绑定
    $("#clear-search-btn").on("click", function () {
        $("#file-search").val("");
        window.LogViewerFileTree.renderRootTree(currentRootPath);
    });

    // 文件树点击处理 - 统一处理逻辑
    $(document).on("click", "#file-list .file-col-name", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!node.directory;
        const isArchive = !isDir && window.LogViewerUtils.isArchiveFileName(node.name);
        const isZipEntry = $li.hasClass("zip-entry");

        if (isDir && !isZipEntry) {
            window.LogViewerFileTree.expandDirectoryNode($li, node.path);
        } else if (isZipEntry && isDir) {
            window.LogViewerFileTree.expandZipDirNode($li);
        } else if (isArchive) {
            window.LogViewerFileTree.expandArchiveNode($li, node.path);
        } else {
            $li.trigger("click");
        }
    });

    $(document).on("click", "#file-list .file-col-size", function (e) {
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node || !!node.directory) return;

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.LogViewerSelectionManager.handleSelectionClick(e, $li);
        } else {
            $li.trigger("click");
        }
    });

    $(document).on("click", "#file-list .file-expander[data-expander='1']", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!node.directory;
        const isArchive = !isDir && window.LogViewerUtils.isArchiveFileName(node.name);

        if ($li.hasClass("zip-entry") && isDir) {
            window.LogViewerFileTree.expandZipDirNode($li);
        } else if (isDir) {
            window.LogViewerFileTree.expandDirectoryNode($li, node.path);
        } else if (isArchive) {
            window.LogViewerFileTree.expandArchiveNode($li, node.path);
        }
    });

    // 文件节点点击处理
    $(document).on("click", "#file-list li.file-node", function (e) {
        const $li = $(this);
        const id = $li.attr("data-id");
        const node = $li.data("node") || {};
        const isDir = !!node.directory;
        const isArchive = !isDir && window.LogViewerUtils.isArchiveFileName(node.name);
        const isZipEntry = $li.hasClass("zip-entry");
        const entryName = $li.attr("data-entry");
        const zipPath = $li.attr("data-zip");

        // 处理目录展开
        if (isDir && !isZipEntry) {
            e.stopPropagation();
            window.LogViewerFileTree.expandDirectoryNode($li, node.path);
            return;
        }
        
        if (isZipEntry && isDir) {
            e.stopPropagation();
            window.LogViewerFileTree.expandZipDirNode($li);
            return;
        }
        
        // 处理压缩包展开或选择
        if (isArchive) {
            if (!(e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.stopPropagation();
                window.LogViewerFileTree.expandArchiveNode($li, node.path);
            } else {
                e.stopPropagation();
                window.LogViewerSelectionManager.handleSelectionClick(e, $li);
            }
            return;
        }

        // 处理多选
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.LogViewerSelectionManager.handleSelectionClick(e, $li);
            return;
        }

        // 处理文件加载
        e.stopPropagation();
        $("#file-list li.file-node").removeClass("active");
        $li.addClass("active");

        window.LogViewerContentRenderer.showLoading();

        // 先获取文件元数据，判断是否使用分页模式
        const filePath = isZipEntry ? zipPath + "!" + entryName : node.path;
        
        $.ajax({
            url: `${apiBase}/file/metadata`,
            method: 'GET',
            data: { file: filePath },
            success: async function(metadata) {
                // 根据文件大小决定使用哪种模式
                const fileSizeMB = metadata.fileSize / (1024 * 1024);
                const shouldUsePagination = fileSizeMB > 10 || metadata.totalLines > 10000;
                
                if (shouldUsePagination) {
                    console.log(`[App] Using pagination mode for ${metadata.isZipEntry ? 'zip entry' : 'file'} (${fileSizeMB.toFixed(2)}MB, ${metadata.totalLines} lines)`);
                    await onFileLoadSuccessPaginated(metadata, filePath);
                } else {
                    console.log(`[App] Using traditional mode for ${metadata.isZipEntry ? 'zip entry' : 'file'} (${fileSizeMB.toFixed(2)}MB, ${metadata.totalLines} lines)`);
                    // 使用传统模式加载
                    if (isZipEntry) {
                        window.LogViewerFileOperations.loadZipEntry(zipPath, entryName, onFileLoadSuccess, onFileLoadError);
                    } else {
                        window.LogViewerFileOperations.loadFsFile(node.path, onFileLoadSuccess, onFileLoadError);
                    }
                }
            },
            error: function(xhr, status, error) {
                console.warn(`[App] Metadata fetch failed for ${filePath}:`, error);
                
                // 显示错误信息
                let errorMessage = '获取文件信息失败';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 500) {
                    errorMessage = '服务器内部错误';
                } else if (xhr.status === 404) {
                    errorMessage = '文件未找到';
                }
                
                // 对于压缩包文件，尝试回退到传统模式
                if (isZipEntry) {
                    console.log(`[App] Falling back to traditional mode for zip entry: ${entryName}`);
                    window.LogViewerFileOperations.loadZipEntry(zipPath, entryName, onFileLoadSuccess, function(fallbackError) {
                        onFileLoadError(`${errorMessage}，传统模式加载也失败: ${fallbackError}`);
                    });
                } else {
                    console.log(`[App] Falling back to traditional mode for file: ${node.path}`);
                    window.LogViewerFileOperations.loadFsFile(node.path, onFileLoadSuccess, function(fallbackError) {
                        onFileLoadError(`${errorMessage}，传统模式加载也失败: ${fallbackError}`);
                    });
                }
            }
        });
    });

    // 下载按钮
    $("#download-btn").on("click", function () {
        const selectedIds = window.LogViewerSelectionManager.getSelectedIds();
        if (selectedIds.size === 0) {
            alert('请先选择要下载的文件');
            return;
        }
        
        try {
            window.LogViewerFileOperations.downloadSelectedFiles(selectedIds, apiBase);
            window.LogViewerSelectionManager.clearAllSelection();
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        }
    });

    // 内容搜索按钮
    $("#search-btn").on("click", async function () {
        if (!activeId) {
            // 在搜索结果面板显示提示
            window.LogViewerUIState.openSearchPanel();
            $("#search-results-list").html(`
                <div class="text-center text-muted p-3">
                    <div>请先选择一个文件</div>
                </div>
            `);
            return;
        }
        
        const keyword = $("#content-search").val().trim();
        if (!keyword) {
            window.LogViewerSearch.clearSearchResults();
            if (!usePaginationMode) {
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
            }
            return;
        }
        
        try {
            const result = await performContentSearch(true);
            
            if (result.matches && result.matches.length > 0) {
                // 跳转到第一个匹配
                const firstMatch = result.matches[0];
                if (usePaginationMode) {
                    await loadPage(firstMatch.page);
                    setTimeout(() => {
                        window.LogViewerContentRenderer.scrollToLine(firstMatch.lineNumber);
                    }, 100);
                } else {
                    window.LogViewerSearch.focusMatch(0, window.LogViewerPagination.getCurrentPage(), handlePageChange);
                }
            }
            // 如果没有匹配，不做任何操作，搜索结果面板会显示"未找到匹配结果"
        } catch (error) {
            // 错误已经在 performContentSearch 中显示在搜索结果面板了
            console.error('搜索失败:', error);
        }
    });

    // 正则表达式模式切换
    $("#use-regex").on("change", function () {
        const $input = $("#content-search");
        if ($(this).is(":checked")) {
            $input.addClass("regex-mode");
            $input.attr("placeholder", "搜索内容（正则表达式）...");
        } else {
            $input.removeClass("regex-mode");
            $input.attr("placeholder", "搜索内容（支持正则表达式）...");
        }
    });

    // 搜索框键盘事件
    $("#content-search").on("keydown", function (e) {
        const matches = window.LogViewerSearch.getCurrentMatches();
        if (!matches.length) return;
        
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIdx = window.LogViewerSearch.getNextMatchIndex();
            window.LogViewerSearch.focusMatch(nextIdx, window.LogViewerPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIdx = window.LogViewerSearch.getPrevMatchIndex();
            window.LogViewerSearch.focusMatch(prevIdx, window.LogViewerPagination.getCurrentPage(), handlePageChange);
        } else if (e.key === "Enter") {
            e.preventDefault();
            $("#search-btn").trigger("click");
        }
    });

    // 滚动按钮 - 使用统一处理函数
    $("#scroll-top-btn").on("click", function () {
        handleScrollAction('top');
    });

    $("#scroll-bottom-btn").on("click", function () {
        handleScrollAction('bottom');
    });

    // 分页按钮事件 - 使用统一处理函数
    $("#page-first-btn").on("click", function () {
        handlePaginationClick('first');
    });

    $("#page-prev-btn").on("click", function () {
        handlePaginationClick('prev');
    });

    $("#page-next-btn").on("click", function () {
        handlePaginationClick('next');
    });

    $("#page-last-btn").on("click", function () {
        handlePaginationClick('last');
    });

    // 页码跳转
    $("#page-jump-input").on("keydown", async function (e) {
        if (e.key === "Enter") {
            const page = parseInt($(this).val(), 10);
            if (isNaN(page) || page < 1) {
                alert('请输入有效的页码');
                return;
            }
            
            const totalPages = window.LogViewerPagination.getTotalPages();
            if (page > totalPages) {
                alert(`页码不能超过总页数 ${totalPages}`);
                return;
            }
            
            if (usePaginationMode) {
                await loadPage(page);
                window.LogViewerContentRenderer.showPageIndicator(page);
            } else {
                const newPage = window.LogViewerPagination.goToPage(page);
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
                window.LogViewerPagination.updatePagination(currentContentLines.length);
                window.LogViewerContentRenderer.showPageIndicator(newPage);
            }
        }
    });

    // 右侧面板关闭按钮
    $("#close-search-btn").on("click", function () {
        window.LogViewerUIState.closeSearchPanel();
    });

    // 实时刷新功能 - 改进版本
    $("#refresh-btn").on("click", async function () {
        const $btn = $(this);
        const $icon = $btn.find('.refresh-btn-icon');
        const $text = $btn.find('.refresh-btn-text');
        const $loading = $btn.find('.refresh-btn-loading');
        
        if (refreshTimer) {
            // 停止刷新
            clearInterval(refreshTimer);
            refreshTimer = null;
            
            // 恢复按钮状态
            $btn.removeClass("refreshing");
            $icon.show();
            $text.text("实时刷新");
            $loading.hide();
            
            return;
        }

        if (!activeId) {
            alert('请先选择一个文件');
            return;
        }

        try {
            if (usePaginationMode) {
                // 分页模式：跳转到最后一页
                const metadata = window.LogViewerPageCache.getStatus().metadata;
                const lastPage = metadata.totalPages;
                await loadPage(lastPage, true);  // 传入 scrollToBottom=true
            } else {
                // 传统模式：跳转到最后一页并滚动到底部
                const totalPages = window.LogViewerPagination.getTotalPages();
                window.LogViewerPagination.setCurrentPage(totalPages);
                window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, totalPages);
                window.LogViewerPagination.updatePagination(currentContentLines.length);
                window.LogViewerContentRenderer.scrollToBottom();
            }

            // 设置刷新状态
            $btn.addClass("refreshing");
            $icon.hide();
            $text.text("停止刷新");
            $loading.show();

            refreshTimer = setInterval(async function () {
                if (!activeId) {
                    console.warn('文件ID丢失，停止刷新');
                    $btn.trigger('click'); // 停止刷新
                    return;
                }

                if (usePaginationMode) {
                    // 分页模式：始终跳转到最后一页并滚动到底部
                    try {
                        const metadata = window.LogViewerPageCache.getStatus().metadata;
                        const lastPage = metadata.totalPages;
                        
                        // 无论是否换页，都重新加载并滚动到底部
                        await loadPage(lastPage, true);  // 传入 scrollToBottom=true
                    } catch (error) {
                        console.error('[Refresh] 刷新跳转失败:', error);
                    }
                } else {
                    // 传统模式：全量重新加载
                    const loadCallback = function(newLines) {
                        try {
                            currentContentLines = newLines;
                            window.LogViewerPagination.updatePagination(currentContentLines.length);
                            
                            // 始终跳转到最后一页并滚动到底部
                            const newTotalPages = window.LogViewerPagination.getTotalPages();
                            window.LogViewerPagination.setCurrentPage(newTotalPages);
                            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newTotalPages);
                            window.LogViewerContentRenderer.scrollToBottom();
                        } catch (error) {
                            console.error('刷新回调处理失败:', error);
                        }
                    };
                    
                    const errorCallback = function(error) {
                        console.error('刷新加载失败:', error);
                        // 不停止刷新，继续尝试
                    };
                    
                    // 根据文件类型加载
                    if (activeId.includes("!")) {
                        const idx = activeId.indexOf("!");
                        const zipPath = activeId.substring(0, idx);
                        const entryName = activeId.substring(idx + 1);
                        window.LogViewerFileOperations.loadZipEntry(zipPath, entryName, loadCallback, errorCallback);
                    } else {
                        window.LogViewerFileOperations.loadFsFile(activeId, loadCallback, errorCallback);
                    }
                }
            }, 500);
            
        } catch (error) {
            console.error('启动实时刷新失败:', error);
            alert('启动实时刷新失败: ' + error.message);
        }
    });

    // 路径选择变更
    $("#path-select").on("change", function () {
        const newPath = $(this).val();
        if (newPath === currentRootPath) return;
        
        // 停止实时刷新
        if (refreshTimer) {
            $("#refresh-btn").trigger('click');
        }
        
        // 清理缓存
        if (usePaginationMode) {
            window.LogViewerPageCache.clear();
        }
        
        currentRootPath = newPath;
        window.LogViewerSelectionManager.clearAllSelection();
        window.LogViewerFileTree.clearExpandedState();
        activeId = null;
        currentContentLines = [];
        usePaginationMode = false;
        currentFileMetadata = null;
        window.LogViewerSearch.clearSearchResults();
        window.LogViewerPagination.reset();
        window.LogViewerUIState.setActiveFileName(null);
        window.LogViewerUIState.setEmptyHintVisible(true);
        window.LogViewerContentRenderer.hideLoading();
        $("#file-search").val("");
        $("#pagination-controls").hide();
        
        window.LogViewerFileTree.renderRootTree(currentRootPath);
    });

    // 左侧栏折叠
    $("#toggle-sidebar").on("click", function () {
        window.LogViewerUIState.toggleSidebar();
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
            const w = Math.max(minW, Math.min(maxW, newWidth));
            main.style.setProperty("--left-width", `${w}px`);
        }
    });

    $(document).on("mouseup", function () {
        if (isResizing) {
            isResizing = false;
            currentResizable = null;
            $("body").css("cursor", "default");
        }
    });

    // 页面卸载时清理资源
    $(window).on("beforeunload", function () {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        if (searchTimer) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        if (usePaginationMode) {
            window.LogViewerPageCache.clear();
        }
    });

    // 初始化完成
    window.LogViewerUIState.setEmptyHintVisible(true);
    window.LogViewerUIState.updateDownloadButton(window.LogViewerSelectionManager.getSelectedIds());
    $("#toggle-sidebar").text($("#main-row").hasClass("left-collapsed") ? "▶" : "◀");
    
    window.LogViewerFileTree.renderRootTree(currentRootPath);
});