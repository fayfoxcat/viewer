/**
 * 内容渲染模块
 */
window.LogViewerContentRenderer = (function() {
    'use strict';

    const LINES_PER_PAGE = 500;

    /**
     * 渲染日志内容
     */
    function renderLogContent(lines, highlightInfo, page) {
        const currentPage = page || 1;
        const startLine = (currentPage - 1) * LINES_PER_PAGE + 1;
        const endLine = Math.min(startLine + LINES_PER_PAGE - 1, lines.length);
        
        const map = highlightInfo || new Map();
        let html = `<div class="log-lines">`;
        
        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            const ln = i + 1;
            const raw = lines[i] ?? "";
            const ranges = map.get(ln) || [];
            
            let textHtml;
            if (ranges.length && window.LogHighlighter) {
                // 有搜索高亮：先应用语法高亮，再叠加搜索高亮
                textHtml = applySyntaxAndSearchHighlight(raw, ranges);
            } else if (window.LogHighlighter) {
                // 仅语法高亮
                textHtml = window.LogHighlighter.highlightLine(raw);
            } else {
                // 降级方案
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
     */
    function scrollToBottom() {
        const $container = $("#log-content-actual");
        const el = $container[0];
        if (!el) return;
        $container.stop(true).animate({ scrollTop: el.scrollHeight }, 150);
    }

    // 公开接口
    return {
        renderLogContent,
        scrollToLine,
        scrollToTop,
        scrollToBottom,
        LINES_PER_PAGE
    };
})();