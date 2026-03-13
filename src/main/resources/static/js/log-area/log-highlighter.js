/**
 * 【日志区】日志语法高亮器
 * 负责加载高亮规则并对日志内容进行语法高亮处理
 */
(function () {
    'use strict';

    let HIGHLIGHT_RULES = [];
    let patternsLoaded = false;

    /**
     * HTML 转义函数
     * 防止 XSS 攻击
     * 
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的 HTML 文本
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 动态生成CSS样式
     * 根据配置的颜色和样式生成对应的CSS规则
     * 
     * @param {Object} patterns - 高亮规则配置
     */
    function generateDynamicStyles(patterns) {
        // 移除之前的动态样式
        const existingStyle = document.getElementById('dynamic-log-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // 创建新的样式元素
        const style = document.createElement('style');
        style.id = 'dynamic-log-styles';
        style.type = 'text/css';

        let css = '';
        Object.entries(patterns).forEach(([key, rule]) => {
            if (rule.highlight && rule.color) {
                const className = rule.className || `log-${key}`;

                // 基础样式
                css += `
#log-content-actual .${className} {
    color: ${rule.color};
    font-weight: bold;
    background: ${rule.color}15;
    padding: 1px 3px;
    border-radius: 2px;
`;

                // 特殊样式处理
                if (className === 'log-url') {
                    css += `    text-decoration: underline;
    cursor: pointer;
`;
                }

                if (className === 'log-exception') {
                    css += `    font-style: italic;
`;
                }

                css += `}
`;
            }
        });

        style.innerHTML = css;
        document.head.appendChild(style);
    }

    /**
     * 从服务器加载高亮规则配置
     * 只加载一次，后续调用直接返回
     * 
     * @returns {Promise<void>}
     */
    async function loadPatterns() {
        if (patternsLoaded) return;

        try {
            const endpoint = window.logViewerEndpoint || '/logs';
            const response = await fetch(`${endpoint}/patterns`);
            const data = await response.json();

            if (data && data.patterns) {
                // 生成动态CSS样式
                generateDynamicStyles(data.patterns);

                HIGHLIGHT_RULES = [];
                Object.entries(data.patterns).forEach(([key, rule]) => {
                    if (rule.highlight) {
                        try {
                            const pattern = new RegExp(rule.regex, 'g');
                            HIGHLIGHT_RULES.push({
                                pattern: pattern,
                                className: rule.className || `log-${key}`
                            });
                        } catch (e) {
                            console.warn(`Invalid regex for pattern ${key}:`, e);
                        }
                    }
                });
            }
            patternsLoaded = true;
        } catch (error) {
            console.error('Failed to load log patterns:', error);
            patternsLoaded = true;
        }
    }

    /**
     * 对单行日志内容进行语法高亮
     * 根据加载的规则匹配并添加 CSS 类名
     * 
     * @param {string} line - 日志行内容
     * @returns {string} 高亮后的 HTML 字符串
     */
    function highlightLine(line) {
        if (!line) return '';
        if (!patternsLoaded || HIGHLIGHT_RULES.length === 0) return escapeHtml(line);

        const matches = [];

        HIGHLIGHT_RULES.forEach(rule => {
            const regex = new RegExp(rule.pattern);
            let match;

            while ((match = regex.exec(line)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                    className: rule.className
                });

                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        });

        matches.sort((a, b) => a.start - b.start);

        const filteredMatches = [];
        let lastEnd = 0;

        matches.forEach(match => {
            if (match.start >= lastEnd) {
                filteredMatches.push(match);
                lastEnd = match.end;
            }
        });

        let result = '';
        let pos = 0;

        filteredMatches.forEach(match => {
            if (match.start > pos) {
                result += escapeHtml(line.substring(pos, match.start));
            }

            result += `<span class="${match.className}">${escapeHtml(match.text)}</span>`;
            pos = match.end;
        });

        if (pos < line.length) {
            result += escapeHtml(line.substring(pos));
        }

        return result;
    }

    /**
     * 对多行日志内容进行语法高亮并生成完整的 HTML
     * 包含行号和高亮后的内容
     * 
     * @param {string[]} lines - 日志行数组
     * @param {number} startLine - 起始行号
     * @param {number} endLine - 结束行号
     * @returns {string} 完整的日志 HTML 字符串
     */
    function highlightLines(lines, startLine, endLine) {
        let html = '<div class="log-lines">';

        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            const lineNumber = i + 1;
            const lineContent = highlightLine(lines[i] || '');

            html += `
                <div class="log-line" data-line="${lineNumber}">
                    <span class="log-ln">${lineNumber}</span>
                    <span class="log-txt">${lineContent}</span>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * 重新加载高亮规则配置
     * 强制从服务器重新获取配置并更新样式
     * 
     * @returns {Promise<void>}
     */
    async function reloadPatterns() {
        patternsLoaded = false;
        HIGHLIGHT_RULES = [];
        await loadPatterns();
    }

    window.LogHighlighter = {
        highlightLine,
        highlightLines,
        loadPatterns,
        reloadPatterns
    };

    loadPatterns();

})();
