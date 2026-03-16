/**
 * 【内容区】内容渲染模块
 * 负责文件内容的渲染、高亮和滚动控制
 */
window.ViewerContentRenderer = (function () {
    'use strict';

    const LINES_PER_PAGE = 1000;
    let currentLines = [];
    let currentHighlightMap = null;
    let currentPage = 1;
    let totalPages = 1;
    let pageIndicatorTimer = null;

    /**
     * 显示加载动画
     * 在文件内容区域显示加载中状态
     */
    function showLoading() {
        $("#content-empty").hide();
        const $actual = $("#content-actual");
        $actual.show().html('');
        const $loading = $actual.find("#loading-overlay");
        if ($loading.length === 0) {
            $actual.append(`
                <div id="loading-overlay" class="loading-overlay" style="display: flex;">
                    <div class="loading-content">
                        <div class="loading-spinner large">
                            <svg class="loading-circle" viewBox="0 0 50 50">
                                <circle class="loading-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
                            </svg>
                        </div>
                        <div class="loading-text">加载中...</div>
                    </div>
                </div>
            `);
        } else {
            $loading.show();
        }
    }

    /**
     * 隐藏加载动画
     * 移除加载中状态的覆盖层
     */
    function hideLoading() {
        $("#content-actual").find("#loading-overlay").remove();
    }

    /**
     * 渲染文件内容
     * 主要渲染函数，支持语法高亮和搜索高亮
     *
     * @param {string[]} lines - 文件行数组
     * @param {Map<number, Array>} highlightInfo - 高亮信息映射（行号 -> 高亮范围数组）
     * @param {number} [page] - 页码
     * @param {number} [startLineNumber] - 起始行号（用于后端分页）
     */
    function renderLogContent(lines, highlightInfo, page, startLineNumber) {
        currentLines = lines;
        currentHighlightMap = highlightInfo;
        currentPage = page || 1;
        totalPages = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));

        renderPageContent(page, startLineNumber);
        hideLoading();
    }

    /**
     * 渲染指定页面的内容
     * 内部方法，处理实际的 HTML 生成
     *
     * @param {number} page - 页码
     * @param {number} [startLineNumber] - 起始行号
     */
    function renderPageContent(page, startLineNumber) {
        const startLine = (page - 1) * LINES_PER_PAGE + 1;
        const endLine = Math.min(startLine + LINES_PER_PAGE - 1, currentLines.length);

        const map = currentHighlightMap || new Map();
        let html = `<div class="content-lines">`;

        for (let i = startLine - 1; i < endLine && i < currentLines.length; i++) {
            const ln = startLineNumber ? (startLineNumber + i) : (i + 1);
            const raw = currentLines[i] ?? "";
            const ranges = map.get(ln) || [];

            let textHtml;
            if (ranges.length && window.LogHighlighter) {
                textHtml = applySyntaxAndSearchHighlight(raw, ranges);
            } else if (window.LogHighlighter) {
                textHtml = window.LogHighlighter.highlightLine(raw);
            } else {
                textHtml = ranges.length ? applyRangesToText(raw, ranges) : window.ViewerUtils.escapeHtml(raw);
            }

            html += `
              <div class="content-line" data-line="${ln}">
                <span class="line-number">${ln}</span>
                <span class="line-text">${textHtml}</span>
              </div>
            `;
        }
        html += `</div>`;

        $("#content-actual").html(html);

        // 恢复标记显示
        if (window.ViewerContextMenu && window.ViewerContextMenu.restoreMarks) {
            window.ViewerContextMenu.restoreMarks();
        }
    }

    /**
     * 应用语法高亮和搜索高亮
     * 先应用语法高亮，再在 DOM 中标记搜索匹配项
     *
     * @param {string} text - 原始文本
     * @param {Array} searchRanges - 搜索匹配范围数组
     * @returns {string} 高亮后的 HTML
     */
    function applySyntaxAndSearchHighlight(text, searchRanges) {
        const syntaxHtml = window.LogHighlighter.highlightLine(text);
        const $temp = $('<div>').html(syntaxHtml);

        searchRanges.forEach(range => {
            highlightRangeInDom($temp[0], range.s, range.e);
        });

        return $temp.html();
    }

    /**
     * 在 DOM 中高亮指定范围
     * 使用 TreeWalker 遍历文本节点并插入 mark 标签
     *
     * @param {HTMLElement} container - 容器元素
     * @param {number} start - 起始位置
     * @param {number} end - 结束位置
     */
    function highlightRangeInDom(container, start, end) {
        let charCount = 0;
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToHighlight = [];
        let node;

        while (node = walker.nextNode()) {
            const nodeStart = charCount;
            const nodeEnd = charCount + node.textContent.length;

            if (nodeEnd > start && nodeStart < end) {
                const highlightStart = Math.max(0, start - nodeStart);
                const highlightEnd = Math.min(node.textContent.length, end - nodeStart);

                nodesToHighlight.push({
                    node: node,
                    start: highlightStart,
                    end: highlightEnd
                });
            }

            charCount = nodeEnd;
            if (charCount >= end) break;
        }

        nodesToHighlight.reverse().forEach(item => {
            const text = item.node.textContent;
            const before = text.substring(0, item.start);
            const highlight = text.substring(item.start, item.end);
            const after = text.substring(item.end);

            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));

            const mark = document.createElement('mark');
            mark.className = 'search-hit';
            mark.textContent = highlight;
            fragment.appendChild(mark);

            if (after) fragment.appendChild(document.createTextNode(after));

            item.node.parentNode.replaceChild(fragment, item.node);
        });
    }

    /**
     * 将高亮范围应用到纯文本
     * 简单的文本高亮，不考虑已有的 HTML 标签
     *
     * @param {string} text - 原始文本
     * @param {Array} ranges - 高亮范围数组
     * @returns {string} 高亮后的 HTML
     */
    function applyRangesToText(text, ranges) {
        const t = String(text ?? "");
        const sorted = ranges.slice().sort((a, b) => a.s - b.s);
        let out = "";
        let pos = 0;
        for (const r of sorted) {
            const s = Math.max(0, Math.min(t.length, r.s));
            const e = Math.max(0, Math.min(t.length, r.e));
            if (e <= s) continue;
            if (s > pos) out += window.ViewerUtils.escapeHtml(t.slice(pos, s));
            out += `<mark class="search-hit">${window.ViewerUtils.escapeHtml(t.slice(s, e))}</mark>`;
            pos = e;
        }
        if (pos < t.length) out += window.ViewerUtils.escapeHtml(t.slice(pos));
        return out;
    }

    /**
     * 滚动到指定行
     * 平滑滚动到目标行并保持在视口上方 1/5 处
     *
     * @param {number} lineNumber - 行号
     */
    function scrollToLine(lineNumber) {
        const $container = $("#content-actual");
        const $line = $container.find(`.content-line[data-line='${lineNumber}']`).first();
        if ($line.length === 0) return;
        const containerHeight = $container.height();
        const targetOffset = containerHeight / 5;
        const top = $line.position().top + $container.scrollTop() - targetOffset;
        $container.stop(true).animate({scrollTop: Math.max(0, top)}, 150);
    }

    /**
     * 滚动到顶部
     * 平滑滚动到内容区域顶部
     */
    function scrollToTop() {
        const $container = $("#content-actual");
        $container.stop(true).animate({scrollTop: 0}, 150);
    }

    /**
     * 滚动到底部
     * 支持立即滚动或平滑滚动
     *
     * @param {boolean} [immediate=false] - 是否立即滚动
     */
    function scrollToBottom(immediate = false) {
        const $container = $("#content-actual");
        const el = $container[0];
        if (!el) return;

        if (immediate) {
            const lastLine = el.querySelector('.content-lines > .content-line:last-child');
            if (lastLine) {
                lastLine.scrollIntoView({block: 'end', behavior: 'instant'});
            } else {
                el.scrollTop = 999999999;
            }
        } else {
            $container.stop(true).animate({scrollTop: el.scrollHeight}, 150);
        }
    }

    /**
     * 滚动到指定位置
     *
     * @param {string} position - 位置：'top' 或 'bottom'
     */
    function scrollToPosition(position) {
        const $container = $("#content-actual");
        const container = $container[0];
        if (!container) return;

        setTimeout(() => {
            if (position === 'top') {
                $container.scrollTop(0);
            } else if (position === 'bottom') {
                $container.scrollTop(container.scrollHeight);
            }
        }, 50);
    }

    /**
     * 显示页面指示器
     * 短暂显示当前页码提示
     *
     * @param {number} page - 页码
     */
    function showPageIndicator(page) {
        const $indicator = $("#page-indicator");
        const $text = $("#page-indicator-text");

        if (pageIndicatorTimer) {
            clearTimeout(pageIndicatorTimer);
        }

        $text.text(`第 ${page} 页`);
        $indicator.removeClass('hide').addClass('show').show();

        pageIndicatorTimer = setTimeout(() => {
            $indicator.removeClass('show').addClass('hide');
            setTimeout(() => {
                $indicator.hide();
            }, 200);
        }, 500);
    }

    return {
        renderLogContent,
        scrollToLine,
        scrollToTop,
        scrollToBottom,
        scrollToPosition,
        showPageIndicator,
        showLoading,
        hideLoading,
        LINES_PER_PAGE
    };
})();
