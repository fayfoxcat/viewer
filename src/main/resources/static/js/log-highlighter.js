(function() {
    'use strict';
    
    const HIGHLIGHT_RULES = [
        { pattern: /\d{4}-\d{2}-\d{2}/g, className: 'log-date' },
        { pattern: /\d{2}:\d{2}:\d{2}[.,]\d{3}/g, className: 'log-time' },
        { pattern: /\b(ERROR|FATAL|SEVERE)\b/gi, className: 'log-error' },
        { pattern: /\b(WARN|WARNING)\b/gi, className: 'log-warning' },
        { pattern: /\b(INFO|INFORMATION)\b/gi, className: 'log-info' },
        { pattern: /\b(DEBUG|TRACE|VERBOSE)\b/gi, className: 'log-debug' },
        { pattern: /\b[A-Z][a-zA-Z0-9]*Exception\b/g, className: 'log-exception' },
        { pattern: /\b[A-Z][a-zA-Z0-9]*Error\b/g, className: 'log-exception' },
        { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, className: 'log-ip' },
        { pattern: /https?:\/\/[^\s]+/g, className: 'log-url' },
        { pattern: /"[^"]*"/g, className: 'log-string' },
        { pattern: /'[^']*'/g, className: 'log-string' },
        { pattern: /\b\d+\b/g, className: 'log-number' }
    ];
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function highlightLine(line) {
        if (!line) return '';
        
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
    
    window.LogHighlighter = {
        highlightLine,
        highlightLines
    };
    
})();
