/**
 * 内容渲染模块
 */
window.LogViewerContentRenderer = (function() {
    'use strict';

    const LINES_PER_PAGE = 1000;
    let currentLines = [];
    let currentHighlightMap = null;
    let currentPage = 1;
    let totalPages = 1;
    let pageIndicatorTimer = null;

    /**
     * 显示加载动画
     */
    function showLoading() {
        $("#log-content-empty").hide();
        const $actual = $("#log-content-actual");
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
     */
    function hideLoading() {
        $("#log-content-actual").find("#loading-overlay").remove();
    }

    /**
     * 渲染日志内容
     * @param {Array} lines - 行数据数组
     * @param {Map} highlightInfo - 高亮信息
     * @param {Number} page - 页码（传统模式使用）
     * @param {Number} startLineNumber - 起始行号（分页模式使用，可选）
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
     * 渲染指定页面内容
     * @param {Number} page - 页码
     * @param {Number} startLineNumber - 起始行号（可选，用于分页模式）
     */
    function renderPageContent(page, startLineNumber) {
        const startLine = (page - 1) * LINES_PER_PAGE + 1;
        const endLine = Math.min(startLine + LINES_PER_PAGE - 1, currentLines.length);
        
        const map = currentHighlightMap || new Map();
        let html = `<div class="log-lines">`;
        
        for (let i = startLine - 1; i < endLine && i < currentLines.length; i++) {
            // 如果提供了 startLineNumber，使用它作为基准；否则使用数组索引
            const ln = startLineNumber ? (startLineNumber + i) : (i + 1);
            const raw = currentLines[i] ?? "";
            const ranges = map.get(ln) || [];
            
            let textHtml;
            if (ranges.length && window.LogHighlighter) {
                textHtml = applySyntaxAndSearchHighlight(raw, ranges);
            } else if (window.LogHighlighter) {
                textHtml = window.LogHighlighter.highlightLine(raw);
            } else {
                textHtml = ranges.length ? applyRangesToText(raw, ranges) : window.LogViewerUtils.escapeHtml(raw);
            }
            
            html += `
              <div class="log-line" data-line="${ln}">
                <span class="log-ln">${ln}</span>
                <span class="log-txt">${textHtml}</span>
              </div>
            `;
        }
        html += `</div>`;
        
        $("#log-content-actual").html(html);
    }

    /**
     * 应用语法高亮和搜索高亮
     * @param {string} text 原始文本
     * @param {Array} searchRanges 搜索匹配范围
     * @returns {string} 高亮后的HTML
     */
    function applySyntaxAndSearchHighlight(text, searchRanges) {
        // 先应用语法高亮
        const syntaxHtml = window.LogHighlighter.highlightLine(text);
        
        // 创建临时 DOM 来处理已高亮的内容
        const $temp = $('<div>').html(syntaxHtml);
        
        // 对每个搜索匹配范围，在 DOM 中添加搜索高亮标记
        searchRanges.forEach(range => {
            highlightRangeInDom($temp[0], range.s, range.e);
        });
        
        return $temp.html();
    }

    /**
     * 在DOM中高亮指定范围
     * @param {Element} container 容器元素
     * @param {number} start 开始位置
     * @param {number} end 结束位置
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
        
        // 从后向前处理，避免影响前面的节点
        nodesToHighlight.reverse().forEach(item => {
            const text = item.node.textContent;
            const before = text.substring(0, item.start);
            const highlight = text.substring(item.start, item.end);
            const after = text.substring(item.end);
            
            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));
            
            const mark = document.createElement('mark');
            mark.className = 'log-hit';
            mark.textContent = highlight;
            fragment.appendChild(mark);
            
            if (after) fragment.appendChild(document.createTextNode(after));
            
            item.node.parentNode.replaceChild(fragment, item.node);
        });
    }

    /**
     * 应用范围高亮到文本
     * @param {string} text 原始文本
     * @param {Array} ranges 高亮范围数组
     * @returns {string} 高亮后的HTML
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
            if (s > pos) out += window.LogViewerUtils.escapeHtml(t.slice(pos, s));
            out += `<mark class="log-hit">${window.LogViewerUtils.escapeHtml(t.slice(s, e))}</mark>`;
            pos = e;
        }
        if (pos < t.length) out += window.LogViewerUtils.escapeHtml(t.slice(pos));
        return out;
    }

    /**
     * 滚动到指定行
     * @param {number} lineNumber 行号
     */
    function scrollToLine(lineNumber) {
        const $container = $("#log-content-actual");
        const $line = $container.find(`.log-line[data-line='${lineNumber}']`).first();
        if ($line.length === 0) return;
        const containerHeight = $container.height();
        const targetOffset = containerHeight / 5;
        const top = $line.position().top + $container.scrollTop() - targetOffset;
        $container.stop(true).animate({ scrollTop: Math.max(0, top) }, 150);
    }

    /**
     * 滚动到顶部
     */
    function scrollToTop() {
        const $container = $("#log-content-actual");
        $container.stop(true).animate({ scrollTop: 0 }, 150);
    }

    /**
     * 滚动到底部
     * @param {boolean} immediate 是否立即滚动（不使用动画）
     */
    function scrollToBottom(immediate = false) {
        const $container = $("#log-content-actual");
        const el = $container[0];
        if (!el) return;
        
        if (immediate) {
            // 使用 scrollIntoView 代替 scrollTop，避免强制同步布局
            // scrollIntoView 由浏览器优化，不会触发昂贵的 reflow
            const lastLine = el.querySelector('.log-lines > .log-line:last-child');
            if (lastLine) {
                lastLine.scrollIntoView({ block: 'end', behavior: 'instant' });
            } else {
                // 如果没有找到最后一行，回退到 scrollTop
                el.scrollTop = 999999999;
            }
        } else {
            // 使用动画滚动
            $container.stop(true).animate({ scrollTop: el.scrollHeight }, 150);
        }
    }

    /**
     * 滚动到页面指定位置
     * @param {string} position 位置（top/bottom）
     */
    function scrollToPosition(position) {
        const $container = $("#log-content-actual");
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
     * 显示页码提示框
     * @param {number} page 页码
     */
    function showPageIndicator(page) {
        const $indicator = $("#page-indicator");
        const $text = $("#page-indicator-text");
        
        // 清除之前的定时器
        if (pageIndicatorTimer) {
            clearTimeout(pageIndicatorTimer);
        }
        
        // 更新页码文本
        $text.text(`第 ${page} 页`);
        
        // 显示提示框
        $indicator.removeClass('hide').addClass('show').show();
        
        // 0.5秒后自动隐藏
        pageIndicatorTimer = setTimeout(() => {
            $indicator.removeClass('show').addClass('hide');
            setTimeout(() => {
                $indicator.hide();
            }, 200); // 等待淡出动画完成
        }, 500);
    }

    /**
     * 跳转到指定页面
     * @param {number} page 页码
     */
    function jumpToPage(page) {
        currentPage = Math.max(1, Math.min(totalPages, page));
        renderPageContent(currentPage);
        
        // 更新分页控件
        window.LogViewerPagination.setCurrentPage(currentPage);
        window.LogViewerPagination.updatePagination(currentLines.length);
        
        // 显示页码提示
        showPageIndicator(currentPage);
        
        // 滚动到顶部
        setTimeout(() => {
            $("#log-content-actual").scrollTop(0);
        }, 50);
    }

    // 公开接口
    return {
        renderLogContent,
        scrollToLine,
        scrollToTop,
        scrollToBottom,
        scrollToPosition,
        jumpToPage,
        showPageIndicator,
        showLoading,
        hideLoading,
        LINES_PER_PAGE
    };
})();