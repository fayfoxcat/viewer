/**
 * 搜索功能模块
 */
window.LogViewerSearch = (function() {
    'use strict';

    let currentMatches = [];
    let currentMatchIndex = -1;
    let currentContentLines = [];

    /**
     * 执行内容搜索
     */
    function runContentSearch(lines, keyword, useRegex, openPanel) {
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
            $item.on("click", function () {
                focusMatch(idx);
            });
            fragment.appendChild($item[0]);
        }
        
        $list.append(fragment);
    }

    /**
     * 聚焦到指定匹配项
     */
    function focusMatch(idx, currentPage, onPageChange) {
        if (!currentMatches.length) return;
        const i = Math.max(0, Math.min(currentMatches.length - 1, idx));
        currentMatchIndex = i;
        const ln = currentMatches[i].lineNumber;

        // 计算目标行所在的页面
        const LINES_PER_PAGE = window.LogViewerContentRenderer.LINES_PER_PAGE;
        const targetPage = Math.ceil(ln / LINES_PER_PAGE);
        
        // 如果不在当前页，先跳转到目标页
        if (targetPage !== currentPage && onPageChange) {
            onPageChange(targetPage, ln);
            return;
        }

        $("#search-results-list .search-result-item").removeClass("active");
        const $activeItem = $(`#search-results-list .search-result-item[data-idx='${i}']`).addClass("active");
        if ($activeItem.length) {
            const el = $activeItem[0];
            el.scrollIntoView({ block: "nearest" });
        }

        // 使用 setTimeout 确保 DOM 已更新
        setTimeout(function() {
            $("#log-content-actual .log-hit-current").removeClass("log-hit-current");
            const $line = $(`#log-content-actual .log-line[data-line='${ln}']`);
            $line.find("mark.log-hit").first().addClass("log-hit-current");
            window.LogViewerContentRenderer.scrollToLine(ln);
        }, 50);
    }

    /**
     * 获取下一个匹配项索引
     */
    function getNextMatchIndex() {
        if (!currentMatches.length) return -1;
        return (currentMatchIndex + 1) % currentMatches.length;
    }

    /**
     * 获取上一个匹配项索引
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
        $("#search-results-list").empty();
    }

    // 公开接口
    return {
        runContentSearch,
        renderSearchResults,
        focusMatch,
        getNextMatchIndex,
        getPrevMatchIndex,
        clearSearchResults,
        getCurrentMatches: () => currentMatches,
        getCurrentMatchIndex: () => currentMatchIndex
    };
})();