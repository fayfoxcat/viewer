/**
 * 【文件内容区】内容语法高亮器
 * 负责加载高亮规则并对内容内容进行语法高亮处理
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
        const existingStyle = document.getElementById('dynamic-viewer-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // 创建新的样式元素
        const style = document.createElement('style');
        style.id = 'dynamic-viewer-styles';
        style.type = 'text/css';

        let css = '';
        Object.entries(patterns).forEach(([key, rule]) => {
            if (rule.highlight && rule.color) {
                const className = rule.className || `viewer-${key}`;

                // 基础样式
                css += `
                    #content-actual .${className} {
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
            const endpoint = window.viewerEndpoint || '/viewer';
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
                                className: rule.className || `viewer-${key}`
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
     * 对单行内容进行语法高亮
     * 根据加载的规则匹配并添加 CSS 类名
     *
     * @param {string} line - 行内容
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

    window.LogHighlighter = {
        highlightLine,
    };

    loadPatterns();

})();
