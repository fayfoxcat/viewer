/**
 * 【搜索结果区】搜索功能模块
 * 负责内容搜索、结果渲染和匹配项导航
 */
window.ViewerSearch = (function () {
    'use strict';

    let currentMatches = [];
    let currentMatchIndex = -1;
    let serverSearchMode = false;

    /**
     * 设置服务端搜索结果
     * 处理服务端返回的搜索结果并转换为内部格式
     *
     * @param {Object} result - 服务端搜索结果
     * @param {Array} result.matches - 匹配项数组
     */
    function setServerSearchResults(result) {
        serverSearchMode = true;
        currentMatches = [];
        currentMatchIndex = -1;

        if (!result.matches || result.matches.length === 0) {
            return;
        }

        result.matches.forEach(match => {
            const line = match.content || "";
            const ranges = match.matchRanges || [];

            let previewHtml = window.ViewerUtils.escapeHtml(line);

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
     * 执行客户端内容搜索
     * 在已加载的内容中进行搜索，支持正则表达式
     *
     * @param {string[]} lines - 内容行数组
     * @param {string} keyword - 搜索关键词
     * @param {boolean} useRegex - 是否使用正则表达式
     * @returns {Object} 搜索结果对象，包含 matches 和 highlightMap
     */
    function runContentSearch(lines, keyword, useRegex) {
        serverSearchMode = false;
        currentMatches = [];
        currentMatchIndex = -1;
        const highlightMap = new Map();

        if (!keyword) {
            return {matches: currentMatches, highlightMap};
        }

        let regex = null;
        if (useRegex) {
            try {
                regex = new RegExp(keyword, "gi");
            } catch (e) {
                regex = null;
            }
        }

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
                    if (e > s) ranges.push({s, e});
                    if (m[0] === "") regex.lastIndex++;
                }
            } else {
                const low = line.toLowerCase();
                const kw = keyword.toLowerCase();
                let pos = 0;
                while (true) {
                    const idx = low.indexOf(kw, pos);
                    if (idx < 0) break;
                    ranges.push({s: idx, e: idx + kw.length});
                    pos = idx + Math.max(1, kw.length);
                }
            }

            if (ranges.length) {
                highlightMap.set(ln, ranges);
                const maxPreviewLength = 200;
                const preview = window.ViewerUtils.escapeHtml(line.length > maxPreviewLength ? line.substring(0, maxPreviewLength) + "..." : line);
                let previewHtml;
                if (regex) {
                    try {
                        const r = new RegExp(regex.source, "gi");
                        previewHtml = preview.replace(r, "<mark>$&</mark>");
                    } catch (e) {
                        previewHtml = preview.replace(new RegExp("(" + window.ViewerUtils.escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                    }
                } else {
                    previewHtml = preview.replace(new RegExp("(" + window.ViewerUtils.escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                }
                currentMatches.push({lineNumber: ln, previewHtml: previewHtml});
            }
        }

        return {matches: currentMatches, highlightMap};
    }

    /**
     * 渲染搜索结果列表
     * 在搜索结果面板中显示所有匹配项
     */
    function renderSearchResults() {
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

        const fragment = document.createDocumentFragment();

        for (let idx = 0; idx < displayCount; idx++) {
            const m = currentMatches[idx];
            const $item = $(`<div class="search-result-item" data-idx="${idx}"></div>`);
            $item.html(`<span class="search-result-number">行 ${m.lineNumber}</span><div class="search-result-line">${m.previewHtml}</div>`);
            $item.on("click", function () {
                const currentPage = window.ViewerPagination ? window.ViewerPagination.getCurrentPage() : 1;
                const onPageChange = window.ViewerApp ? window.ViewerApp.handlePageChange : null;
                focusMatch(idx, currentPage, onPageChange);
            });
            fragment.appendChild($item[0]);
        }

        $list.append(fragment);
    }

    /**
     * 聚焦到指定的搜索匹配项
     * 高亮显示匹配项并滚动到对应位置
     *
     * @param {number} idx - 匹配项索引
     * @param {number} currentPage - 当前页码
     * @param {Function} onPageChange - 页面切换回调函数
     */
    function focusMatch(idx, currentPage, onPageChange) {
        if (!currentMatches.length) return;
        const i = Math.max(0, Math.min(currentMatches.length - 1, idx));
        currentMatchIndex = i;
        const match = currentMatches[i];
        const ln = match.lineNumber;

        $("#search-results-list .search-result-item").removeClass("active");
        const $activeItem = $(`#search-results-list .search-result-item[data-idx='${i}']`).addClass("active");
        if ($activeItem.length) {
            const el = $activeItem[0];
            el.scrollIntoView({block: "nearest"});
        }

        if (serverSearchMode && match.page) {
            if (match.page !== currentPage && onPageChange) {
                onPageChange(match.page, ln).then(() => {
                    highlightCurrentMatch(ln);
                });
                return;
            }
        } else {
            const LINES_PER_PAGE = window.ViewerContentRenderer.LINES_PER_PAGE;
            const targetPage = Math.ceil(ln / LINES_PER_PAGE);

            if (targetPage !== currentPage && onPageChange) {
                onPageChange(targetPage, ln);
                return;
            }
        }

        highlightCurrentMatch(ln);
    }

    /**
     * 高亮当前匹配项
     * 在内容区域中高亮显示当前匹配的行
     *
     * @param {number} lineNumber - 行号
     */
    function highlightCurrentMatch(lineNumber) {
        setTimeout(function () {
            $("#content-actual .search-hit-current").removeClass("search-hit-current");
            const $line = $(`#content-actual .content-line[data-line='${lineNumber}']`);
            $line.find("mark.search-hit").addClass("search-hit-current");
            window.ViewerContentRenderer.scrollToLine(lineNumber);
        }, 50);
    }

    /**
     * 获取下一个匹配项的索引
     *
     * @returns {number} 下一个匹配项索引，循环到开头
     */
    function getNextMatchIndex() {
        if (!currentMatches.length) return -1;
        return (currentMatchIndex + 1) % currentMatches.length;
    }

    /**
     * 获取上一个匹配项的索引
     *
     * @returns {number} 上一个匹配项索引，循环到末尾
     */
    function getPrevMatchIndex() {
        if (!currentMatches.length) return -1;
        return (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
    }

    /**
     * 清除搜索结果
     * 重置所有搜索相关状态和 UI
     */
    function clearSearchResults() {
        currentMatches = [];
        currentMatchIndex = -1;
        serverSearchMode = false;
        $("#search-results-list").empty();
    }

    return {
        setServerSearchResults,
        renderSearchResults,
        focusMatch,
        getNextMatchIndex,
        getPrevMatchIndex,
        clearSearchResults,
        getCurrentMatches: () => currentMatches
    };
})();
