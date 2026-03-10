/**
 * 主应用模块 - 日志查看器
 */
$(document).ready(function () {
    'use strict';

    // API 基础路径
    const apiBase = window.location.pathname.replace(/\/$/, "");
    
    // 检查认证
    if (!window.LogViewerAuth.init(apiBase)) {
        return; // 需要认证，阻止后续初始化
    }

    // 应用状态
    let currentRootPath = $("#path-select").val();
    let activeId = null;
    let refreshTimer = null;
    let currentContentLines = [];

    // 初始化各模块
    window.LogViewerFileTree.init(apiBase);
    window.LogViewerFileOperations.init(apiBase);

    // 文件加载成功回调
    function onFileLoadSuccess(lines, fileId) {
        activeId = fileId;
        window.LogViewerUIState.setActiveFileName(fileId);
        currentContentLines = lines;
        window.LogViewerPagination.reset();

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

    // 文件加载失败回调
    function onFileLoadError(message) {
        window.LogViewerContentRenderer.hideLoading();
        $("#log-content-actual").html(`<div class="text-center text-danger p-5">${message}</div>`);
        $("#log-content-actual").show();
    }

    // 执行内容搜索
    function performContentSearch(openPanel = false) {
        const keyword = $("#content-search").val().trim();
        const useRegex = $("#use-regex").is(":checked");
        
        if (!activeId || !keyword) {
            window.LogViewerSearch.clearSearchResults();
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
            return;
        }

        const result = window.LogViewerSearch.runContentSearch(currentContentLines, keyword, useRegex, openPanel);
        
        setTimeout(function() {
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, result.highlightMap, window.LogViewerPagination.getCurrentPage());
            window.LogViewerSearch.renderSearchResults(keyword, useRegex);
            if (openPanel !== false) window.LogViewerUIState.openSearchPanel();
        }, 0);
    }

    // 页面跳转处理
    function handlePageChange(targetPage, lineNumber, scrollPosition) {
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

    // 排序按钮事件
    $(document).on("click", ".sort-btn", function() {
        const sortBy = $(this).data("sort");
        const sortOrder = $(this).data("order");
        
        window.LogViewerFileTree.setSortBy(sortBy, sortOrder);
        window.LogViewerFileTree.renderRootTree(currentRootPath);
    });

    // 左侧文件搜索
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
                function() {
                    $("#file-list").html(`<li class="text-center text-danger">搜索失败</li>`);
                }
            );
        }, 250);
    });

    // 事件绑定
    $("#clear-search-btn").on("click", function () {
        $("#file-search").val("");
        window.LogViewerFileTree.renderRootTree(currentRootPath);
    });

    // 左侧树点击处理
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
            return;
        }
        
        if (isZipEntry && isDir) {
            window.LogViewerFileTree.expandZipDirNode($li);
            return;
        }
        
        if (isArchive) {
            window.LogViewerFileTree.expandArchiveNode($li, node.path);
            return;
        }
        
        $li.trigger("click");
    });

    $(document).on("click", "#file-list .file-col-size", function (e) {
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node || !!node.directory) return;

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.LogViewerSelectionManager.handleSelectionClick(e, $li);
            return;
        }

        $li.trigger("click");
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

    $(document).on("click", "#file-list li.file-node", function (e) {
        const $li = $(this);
        const id = $li.attr("data-id");
        const node = $li.data("node") || {};
        const isDir = !!node.directory;
        const isArchive = !isDir && window.LogViewerUtils.isArchiveFileName(node.name);
        const isZipEntry = $li.hasClass("zip-entry");
        const entryName = $li.attr("data-entry");
        const zipPath = $li.attr("data-zip");

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

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            window.LogViewerSelectionManager.handleSelectionClick(e, $li);
            return;
        }

        e.stopPropagation();
        $("#file-list li.file-node").removeClass("active");
        $li.addClass("active");

        // 显示加载中
        window.LogViewerContentRenderer.showLoading();

        if (isZipEntry) {
            window.LogViewerFileOperations.loadZipEntry(zipPath, entryName, onFileLoadSuccess, onFileLoadError);
        } else {
            window.LogViewerFileOperations.loadFsFile(node.path, onFileLoadSuccess, onFileLoadError);
        }
    });

    // 下载按钮
    $("#download-btn").on("click", function () {
        const selectedIds = window.LogViewerSelectionManager.getSelectedIds();
        window.LogViewerFileOperations.downloadSelectedFiles(selectedIds, apiBase);
        window.LogViewerSelectionManager.clearAllSelection();
    });

    // 内容搜索按钮
    $("#search-btn").on("click", function () {
        if (!activeId) return;
        
        const keyword = $("#content-search").val().trim();
        if (!keyword) {
            window.LogViewerSearch.clearSearchResults();
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
            return;
        }
        
        performContentSearch(true);
        const matches = window.LogViewerSearch.getCurrentMatches();
        if (matches.length) {
            window.LogViewerSearch.focusMatch(0, window.LogViewerPagination.getCurrentPage(), handlePageChange);
        }
    });

    // 正则表达式模式切换
    $("#use-regex").on("change", function () {
        const $input = $("#content-search");
        if ($(this).is(":checked")) {
            $input.addClass("regex-mode");
        } else {
            $input.removeClass("regex-mode");
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

    // 滚动按钮
    $("#scroll-top-btn").on("click", function () {
        if (!activeId) return;
        if (window.LogViewerPagination.getCurrentPage() !== 1) {
            const newPage = window.LogViewerPagination.goToPage(1);
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
            window.LogViewerPagination.updatePagination(currentContentLines.length);
        }
        window.LogViewerContentRenderer.scrollToTop();
    });

    $("#scroll-bottom-btn").on("click", function () {
        if (!activeId) return;
        const totalPages = window.LogViewerPagination.getTotalPages();
        if (window.LogViewerPagination.getCurrentPage() !== totalPages) {
            const newPage = window.LogViewerPagination.goToPage(totalPages);
            window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
            window.LogViewerPagination.updatePagination(currentContentLines.length);
        }
        window.LogViewerContentRenderer.scrollToBottom();
    });

    // 分页按钮事件
    $("#page-first-btn").on("click", function () {
        if (!activeId || window.LogViewerPagination.getCurrentPage() <= 1) return;
        
        const newPage = window.LogViewerPagination.goToPage(1);
        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerContentRenderer.showPageIndicator(newPage);
    });

    $("#page-prev-btn").on("click", function () {
        const currentPage = window.LogViewerPagination.getCurrentPage();
        if (!activeId || currentPage <= 1) return;
        
        const newPage = window.LogViewerPagination.goToPage(currentPage - 1);
        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerContentRenderer.showPageIndicator(newPage);
    });

    $("#page-next-btn").on("click", function () {
        const currentPage = window.LogViewerPagination.getCurrentPage();
        const totalPages = window.LogViewerPagination.getTotalPages();
        if (!activeId || currentPage >= totalPages) return;
        
        const newPage = window.LogViewerPagination.goToPage(currentPage + 1);
        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerContentRenderer.showPageIndicator(newPage);
    });

    $("#page-last-btn").on("click", function () {
        const totalPages = window.LogViewerPagination.getTotalPages();
        if (!activeId || window.LogViewerPagination.getCurrentPage() >= totalPages) return;
        
        const newPage = window.LogViewerPagination.goToPage(totalPages);
        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newPage);
        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerContentRenderer.showPageIndicator(newPage);
    });

    $("#page-jump-input").on("keydown", function (e) {
        if (e.key === "Enter") {
            const page = parseInt($(this).val(), 10);
            if (!isNaN(page)) {
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

    // 实时刷新
    $("#refresh-btn").on("click", function () {
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

        if (!activeId) return;

        const totalPages = window.LogViewerPagination.getTotalPages();
        window.LogViewerPagination.setCurrentPage(totalPages);
        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, totalPages);
        window.LogViewerPagination.updatePagination(currentContentLines.length);
        window.LogViewerContentRenderer.scrollToBottom();

        // 设置刷新状态
        $btn.addClass("refreshing");
        $icon.hide();
        $text.text("停止刷新");
        $loading.show();

        refreshTimer = setInterval(function () {
            const $content = $("#log-content-actual");
            const keepBottom = window.LogViewerUtils.isNearBottom($content);
            const currentPageSnapshot = window.LogViewerPagination.getCurrentPage();

            if (!activeId) return;
            
            const loadCallback = function(newLines) {
                const oldLineCount = currentContentLines.length;
                currentContentLines = newLines;
                
                window.LogViewerPagination.updatePagination(currentContentLines.length);
                
                if (keepBottom) {
                    const newTotalPages = window.LogViewerPagination.getTotalPages();
                    window.LogViewerPagination.setCurrentPage(newTotalPages);
                    window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, newTotalPages);
                    window.LogViewerContentRenderer.scrollToBottom();
                } else if (currentPageSnapshot !== window.LogViewerPagination.getCurrentPage()) {
                    window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
                } else {
                    const newLineCount = currentContentLines.length;
                    if (newLineCount > oldLineCount) {
                        window.LogViewerContentRenderer.renderLogContent(currentContentLines, null, window.LogViewerPagination.getCurrentPage());
                    }
                }
            };
            
            if (activeId.includes("!")) {
                const idx = activeId.indexOf("!");
                const zipPath = activeId.substring(0, idx);
                const entryName = activeId.substring(idx + 1);
                window.LogViewerFileOperations.loadZipEntry(zipPath, entryName, loadCallback);
            } else {
                window.LogViewerFileOperations.loadFsFile(activeId, loadCallback);
            }
        }, 2000);
    });

    // 路径选择变更
    $("#path-select").on("change", function () {
        currentRootPath = $(this).val();
        window.LogViewerSelectionManager.clearAllSelection();
        window.LogViewerFileTree.clearExpandedState();
        activeId = null;
        currentContentLines = [];
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

    // 初始化
    window.LogViewerUIState.setEmptyHintVisible(true);
    window.LogViewerUIState.updateDownloadButton(window.LogViewerSelectionManager.getSelectedIds());
    $("#toggle-sidebar").text($("#main-row").hasClass("left-collapsed") ? "▶" : "◀");
    window.LogViewerFileTree.renderRootTree(currentRootPath);
});