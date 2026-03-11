/**
 * 搜索功能模块
 */
window.LogViewerSearch = (function() {
    'use strict';

    let currentMatches = [];
    let currentMatchIndex = -1;
    let currentContentLines = [];
    let serverSearchMode = false;

    /**
     * 设置服务端搜索结果
     * @param {Object} result 搜索结果
     * @param {boolean} isPaginationMode 是否为分页模式
     */
    function setServerSearchResults(result, isPaginationMode) {
        serverSearchMode = true;
        currentMatches = [];
        currentMatchIndex = -1;
        
        if (!result.matches || result.matches.length === 0) {
            return;
        }
        
        result.matches.forEach(match => {
            const line = match.content || "";
            const ranges = match.matchRanges || [];
            
            let previewHtml = window.LogViewerUtils.escapeHtml(line);
            
            const sortedRanges = ranges.slice().sort((a, b) => b.start - a.start);
            sortedRanges.forEach(range => {
                const before = previewHtml.substring(0, range.start);
                const matched = previewHtml.substring(range.start, range.end);
                const after = previewHtml.substring(range.end);
                previewHtml = before + '<mark>' + matched + '</mark>' + after;
            });
            
            currentMatches.push({
                lineNumber: match.lineNumber,
                previewHtml: previewHtml,
                page: match.page,
                ranges: ranges
            });
        });
    }

    /**
     * 执行内容搜索
     * @param {Array} lines 文件行数组
     * @param {string} keyword 搜索关键词
     * @param {boolean} useRegex 是否使用正则表达式
     * @param {boolean} openPanel 是否打开搜索面板
     * @returns {Object} 搜索结果对象
     */
    function runContentSearch(lines, keyword, useRegex, openPanel) {
        serverSearchMode = false;
        currentContentLines = lines;
        currentMatches = [];
        currentMatchIndex = -1;
        const highlightMap = new Map();

        if (!keyword) {
            return { matches: currentMatches, highlightMap };
        }

        let regex = null;
        if (useRegex) {
            try {
                regex = new RegExp(keyword, "gi");
            } catch (e) {
                regex = null;
            }
        }

        // 显示搜索进度提示（大文件）
        if (lines.length > 10000) {
            $("#search-results-list").html(`<div class="text-center p-3"><div class="loading-spinner"></div> 搜索中...</div>`);
        }

        for (let i = 0; i < lines.length; i++) {
            const ln = i + 1;
            const line = String(lines[i] ?? "");
            let ranges = [];

            if (regex) {
                regex.lastIndex = 0;
                let m;
                while ((m = regex.exec(line)) !== null) {
                    const s = m.index;
                    const e = m.index + String(m[0] ?? "").length;
                    if (e > s) ranges.push({ s, e });
                    if (m[0] === "") regex.lastIndex++;
                }
            } else {
                const low = line.toLowerCase();
                const kw = keyword.toLowerCase();
                let pos = 0;
                while (true) {
                    const idx = low.indexOf(kw, pos);
                    if (idx < 0) break;
                    ranges.push({ s: idx, e: idx + kw.length });
                    pos = idx + Math.max(1, kw.length);
                }
            }

            if (ranges.length) {
                highlightMap.set(ln, ranges);
                // 限制预览文本长度以提升性能
                const maxPreviewLength = 200;
                const preview = window.LogViewerUtils.escapeHtml(line.length > maxPreviewLength ? line.substring(0, maxPreviewLength) + "..." : line);
                let previewHtml;
                if (regex) {
                    try {
                        const r = new RegExp(regex.source, "gi");
                        previewHtml = preview.replace(r, "<mark>$&</mark>");
                    } catch (e) {
                        previewHtml = preview.replace(new RegExp("(" + window.LogViewerUtils.escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                    }
                } else {
                    previewHtml = preview.replace(new RegExp("(" + window.LogViewerUtils.escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                }
                currentMatches.push({ lineNumber: ln, previewHtml: previewHtml });
            }
        }

        return { matches: currentMatches, highlightMap };
    }

    /**
     * 渲染搜索结果
     * @param {string} keyword 搜索关键词
     * @param {boolean} useRegex 是否使用正则表达式
     */
    function renderSearchResults(keyword, useRegex) {
        const $list = $("#search-results-list");
        $list.empty();

        if (currentMatches.length === 0) {
            $list.html(`<div class="no-results">未找到匹配结果</div>`);
            return;
        }

        const MAX_RESULTS_DISPLAY = 1000;
        const displayCount = Math.min(currentMatches.length, MAX_RESULTS_DISPLAY);
        
        let headerText = `找到 ${currentMatches.length} 条结果`;
        if (currentMatches.length > MAX_RESULTS_DISPLAY) {
            headerText += ` (显示前 ${MAX_RESULTS_DISPLAY} 条)`;
        }
        
        $list.append(`<div class="p-2 bg-light border-bottom"><strong>${headerText}</strong></div>`);
        
        // 使用文档片段提升性能
        const fragment = document.createDocumentFragment();
        
        for (let idx = 0; idx < displayCount; idx++) {
            const m = currentMatches[idx];
            const $item = $(`<div class="search-result-item" data-idx="${idx}"></div>`);
            $item.html(`<span class="search-result-number">行 ${m.lineNumber}</span><div class="search-result-line">${m.previewHtml}</div>`);
            // 注意：这里不传递 currentPage 和 onPageChange，让 focusMatch 内部处理
            // 因为点击时需要获取最新的页面状态
            $item.on("click", function () {
                // 从全局获取当前页和页面切换函数
                const currentPage = window.LogViewerPagination ? window.LogViewerPagination.getCurrentPage() : 1;
                const onPageChange = window.LogViewerApp ? window.LogViewerApp.handlePageChange : null;
                focusMatch(idx, currentPage, onPageChange);
            });
            fragment.appendChild($item[0]);
        }
        
        $list.append(fragment);
    }

    /**
     * 聚焦到指定匹配项
     * @param {number} idx 匹配项索引
     * @param {number} currentPage 当前页码
     * @param {Function} onPageChange 页面切换回调函数
     */
    function focusMatch(idx, currentPage, onPageChange) {
        if (!currentMatches.length) return;
        const i = Math.max(0, Math.min(currentMatches.length - 1, idx));
        currentMatchIndex = i;
        const match = currentMatches[i];
        const ln = match.lineNumber;

        // 高亮搜索结果列表中的当前项
        $("#search-results-list .search-result-item").removeClass("active");
        const $activeItem = $(`#search-results-list .search-result-item[data-idx='${i}']`).addClass("active");
        if ($activeItem.length) {
            const el = $activeItem[0];
            el.scrollIntoView({ block: "nearest" });
        }

        // 如果是服务端搜索模式，使用 page 信息
        if (serverSearchMode && match.page) {
            if (match.page !== currentPage && onPageChange) {
                // 页面不同，需要切换页面
                onPageChange(match.page, ln).then(() => {
                    // 页面切换后，高亮当前匹配项
                    highlightCurrentMatch(ln);
                });
                return;
            }
        } else {
            // 传统模式：计算目标行所在的页面
            const LINES_PER_PAGE = window.LogViewerContentRenderer.LINES_PER_PAGE;
            const targetPage = Math.ceil(ln / LINES_PER_PAGE);
            
            if (targetPage !== currentPage && onPageChange) {
                onPageChange(targetPage, ln);
                return;
            }
        }

        // 同一页面，直接高亮
        highlightCurrentMatch(ln);
    }

    /**
     * 高亮当前匹配项
     * @param {number} lineNumber 行号
     */
    function highlightCurrentMatch(lineNumber) {
        setTimeout(function() {
            $("#log-content-actual .log-hit-current").removeClass("log-hit-current");
            const $line = $(`#log-content-actual .log-line[data-line='${lineNumber}']`);
            
            // 将该行的所有匹配标记都设为当前匹配（红色）
            $line.find("mark.log-hit").addClass("log-hit-current");
            
            window.LogViewerContentRenderer.scrollToLine(lineNumber);
        }, 50);
    }

    /**
     * 获取下一个匹配项索引
     * @returns {number} 下一个匹配项索引
     */
    function getNextMatchIndex() {
        if (!currentMatches.length) return -1;
        return (currentMatchIndex + 1) % currentMatches.length;
    }

    /**
     * 获取上一个匹配项索引
     * @returns {number} 上一个匹配项索引
     */
    function getPrevMatchIndex() {
        if (!currentMatches.length) return -1;
        return (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
    }

    /**
     * 清空搜索结果
     */
    function clearSearchResults() {
        currentMatches = [];
        currentMatchIndex = -1;
        serverSearchMode = false;
        $("#search-results-list").empty();
    }

    // 公开接口
    return {
        runContentSearch,
        setServerSearchResults,
        renderSearchResults,
        focusMatch,
        getNextMatchIndex,
        getPrevMatchIndex,
        clearSearchResults,
        getCurrentMatches: () => currentMatches,
        getCurrentMatchIndex: () => currentMatchIndex
    };
})();