/**
 * 【内容区】右键菜单模块
 * 负责文件内容区域的右键菜单功能
 */
window.ViewerContextMenu = (function () {
    'use strict';

    let $menu = null;
    let currentSelection = null;
    let currentLineNumber = null;
    let markedLines = new Set();

    /**
     * 初始化右键菜单
     */
    function init() {
        createMenuElement();
        bindEvents();
    }

    /**
     * 创建菜单 DOM 元素
     */
    function createMenuElement() {
        $menu = $('<div class="context-menu"></div>');
        $('body').append($menu);
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        // 阻止默认右键菜单
        $(document).on('contextmenu', '#content-actual', function (e) {
            e.preventDefault();
            showContextMenu(e);
            return false;
        });

        // 点击其他地方关闭菜单
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.context-menu').length) {
                hideMenu();
            }
        });

        // 滚动时关闭菜单
        $('#content-actual').on('scroll', function () {
            hideMenu();
        });

        // 键盘快捷键
        $(document).on('keydown', function (e) {
            // ESC 关闭菜单
            if (e.key === 'Escape') {
                hideMenu();
            }

            // Ctrl+C 复制选中文字
            if (e.ctrlKey && e.key === 'c') {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                if (selectedText && $(selection.anchorNode).closest('#content-actual').length > 0) {
                    // 静默复制，不显示通知
                }
            }

            // Ctrl+F 搜索选中文字
            if (e.ctrlKey && e.key === 'f') {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                if (selectedText && $(selection.anchorNode).closest('#content-actual').length > 0) {
                    e.preventDefault();
                    $('#content-search').val(selectedText).focus();
                }
            }
        });
    }

    /**
     * 显示右键菜单
     */
    function showContextMenu(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // 获取点击位置的行号
        const $line = $(e.target).closest('.content-line');
        currentLineNumber = $line.length ? parseInt($line.attr('data-line')) : null;

        if (selectedText) {
            // 有选中文字时的菜单
            currentSelection = selectedText;
            showSelectionMenu(e);
        } else {
            // 无选中文字时的菜单
            currentSelection = null;
            showDefaultMenu(e);
        }
    }

    /**
     * 显示选中文字时的菜单
     */
    function showSelectionMenu(e) {
        const menuItems = [
            {icon: '🔍', text: '搜索', action: 'search'},
            {icon: '📋', text: '复制', action: 'copy'},
            {icon: '🖍️', text: '高亮', action: 'highlight'}
        ];

        renderMenu(menuItems);
        positionMenu(e);
    }

    /**
     * 显示默认菜单（无选中文字）
     */
    function showDefaultMenu(e) {
        const activeFileName = window.ViewerUIState ? window.ViewerUIState.getActiveFileName() : null;
        const isMarked = currentLineNumber && markedLines.has(currentLineNumber);

        // 检查是否有高亮内容
        const hasHighlights = $('.content-line .line-text mark.custom-highlight').length > 0;

        const menuItems = [
            {
                icon: isMarked ? '🏷️' : '🏷️',
                text: isMarked ? '移除标记' : '添加标记',
                action: isMarked ? 'unmark' : 'mark',
                disabled: !currentLineNumber
            },
            {icon: '🗑️', text: '清除标记', action: 'clearMarks', disabled: markedLines.size === 0},
            {icon: '🧹', text: '清除高亮', action: 'clearHighlights', disabled: !hasHighlights},
            {divider: true},
            {icon: '📁', text: '复制路径', action: 'copyPath', disabled: !activeFileName},
            {icon: '⬇️', text: '下载文件', action: 'download', disabled: !activeFileName},
            {icon: '📸', text: '截图', action: 'screenshotFull', disabled: !activeFileName},
            {icon: '🖨️', text: '打印', action: 'print', disabled: !activeFileName}
        ];

        renderMenu(menuItems);
        positionMenu(e);
    }

    /**
     * 渲染菜单
     */
    function renderMenu(items) {
        $menu.empty();

        items.forEach(item => {
            if (item.divider) {
                $menu.append('<div class="context-menu-divider"></div>');
            } else {
                const $item = $('<div class="context-menu-item"></div>');
                if (item.disabled) {
                    $item.addClass('disabled');
                }

                $item.html(`
                    <span class="context-menu-icon">${item.icon}</span>
                    <span>${item.text}</span>
                `);

                if (!item.disabled) {
                    $item.on('click', function () {
                        handleMenuAction(item.action);
                        hideMenu();
                    });
                }

                $menu.append($item);
            }
        });
    }

    /**
     * 定位菜单
     */
    function positionMenu(e) {
        $menu.css({
            left: e.pageX + 'px',
            top: e.pageY + 'px',
            display: 'block'
        });

        // 确保菜单不超出视口
        const menuWidth = $menu.outerWidth();
        const menuHeight = $menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();

        if (e.pageX + menuWidth > windowWidth) {
            $menu.css('left', (e.pageX - menuWidth) + 'px');
        }

        if (e.pageY + menuHeight > windowHeight) {
            $menu.css('top', (e.pageY - menuHeight) + 'px');
        }
    }

    /**
     * 隐藏菜单
     */
    function hideMenu() {
        $menu.hide();
    }

    /**
     * 处理菜单操作
     */
    function handleMenuAction(action) {
        switch (action) {
            case 'search':
                performSearch();
                break;
            case 'copy':
                performCopy();
                break;
            case 'highlight':
                performHighlight();
                break;
            case 'mark':
                performMark();
                break;
            case 'unmark':
                performUnmark();
                break;
            case 'clearMarks':
                performClearMarks();
                break;
            case 'clearHighlights':
                performClearHighlights();
                break;
            case 'copyPath':
                performCopyPath();
                break;
            case 'download':
                performDownload();
                break;
            case 'screenshotFull':
                performScreenshotFull();
                break;
            case 'print':
                performPrint();
                break;
        }
    }

    /**
     * 搜索选中文字
     */
    function performSearch() {
        if (!currentSelection) return;

        $('#content-search').val(currentSelection);
        $('#search-btn').trigger('click');
    }

    /**
     * 复制选中文字
     */
    function performCopy() {
        if (!currentSelection) return;

        navigator.clipboard.writeText(currentSelection).then(() => {
            // 静默复制，不显示通知
        }).catch(err => {
            console.error('复制失败:', err);
            if (window.ViewerNotification) {
                window.ViewerNotification.show({
                    message: '复制失败',
                    type: 'error'
                });
            }
        });
    }

    /**
     * 高亮选中文字
     */
    function performHighlight() {
        if (!currentSelection || !currentLineNumber) return;

        // 在当前行中查找并高亮选中的文字
        const $line = $(`.content-line[data-line="${currentLineNumber}"]`);
        if ($line.length === 0) return;

        const $lineText = $line.find('.line-text');
        let html = $lineText.html();

        // 移除之前的自定义高亮
        html = html.replace(/<mark class="custom-highlight"[^>]*>([^<]*)<\/mark>/g, '$1');

        // 添加新的高亮
        const escapedText = currentSelection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        html = html.replace(regex, '<mark class="custom-highlight">$1</mark>');

        $lineText.html(html);

        if (window.ViewerNotification) {
            // 移除高亮通知
        }
    }

    /**
     * 清除所有高亮
     */
    function performClearHighlights() {
        // 移除所有自定义高亮
        $('.content-line .line-text mark.custom-highlight').each(function () {
            const $mark = $(this);
            $mark.replaceWith($mark.text());
        });

        if (window.ViewerNotification) {
            // 移除清除高亮通知
        }
    }

    /**
     * 标记当前行
     */
    function performMark() {
        if (!currentLineNumber) return;

        markedLines.add(currentLineNumber);
        updateMarkDisplay();

        if (window.ViewerNotification) {
            window.ViewerNotification.show({
                message: `已标记第 ${currentLineNumber} 行`,
                type: 'success'
            });
        }
    }

    /**
     * 移除标记
     */
    function performUnmark() {
        if (!currentLineNumber) return;

        markedLines.delete(currentLineNumber);
        updateMarkDisplay();

        if (window.ViewerNotification) {
            window.ViewerNotification.show({
                message: `已移除第 ${currentLineNumber} 行的标记`,
                type: 'success'
            });
        }
    }

    /**
     * 清除所有标记
     */
    function performClearMarks() {
        const count = markedLines.size;
        markedLines.clear();
        updateMarkDisplay();

        if (window.ViewerNotification) {
            window.ViewerNotification.show({
                message: `已清除 ${count} 个标记`,
                type: 'success'
            });
        }
    }

    /**
     * 更新标记显示
     */
    function updateMarkDisplay() {
        $('.content-line').removeClass('marked');
        markedLines.forEach(lineNumber => {
            $(`.content-line[data-line="${lineNumber}"]`).addClass('marked');
        });
    }

    /**
     * 在内容渲染后恢复标记
     */
    function restoreMarks() {
        updateMarkDisplay();
    }

    /**
     * 复制文件路径
     */
    function performCopyPath() {
        const filePath = window.ViewerUIState ? window.ViewerUIState.getActiveFileName() : null;
        if (!filePath) return;

        navigator.clipboard.writeText(filePath).then(() => {
            if (window.ViewerNotification) {
                window.ViewerNotification.show({
                    message: '已复制文件路径',
                    type: 'success'
                });
            }
        }).catch(err => {
            console.error('复制失败:', err);
            if (window.ViewerNotification) {
                window.ViewerNotification.show({
                    message: '复制失败',
                    type: 'error'
                });
            }
        });
    }

    /**
     * 下载文件
     */
    function performDownload() {
        const filePath = window.ViewerUIState ? window.ViewerUIState.getActiveFileName() : null;
        if (!filePath) return;

        const apiBase = window.location.pathname.replace(/\/$/, "");

        // 创建表单提交下载请求
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${apiBase}/download`;
        form.style.display = 'none';

        const fileInput = document.createElement('input');
        fileInput.type = 'hidden';
        fileInput.name = 'files';
        fileInput.value = filePath;

        form.appendChild(fileInput);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

    /**
     * 截图整页
     */
    async function performScreenshotFull() {
        try {
            // 导入 html2canvas 库
            if (typeof html2canvas === 'undefined') {
                await loadHtml2Canvas();
            }

            const $content = $('#content-actual');
            if ($content.length === 0) return;

            // 获取文件名
            const fileName = getFileName();
            const screenshotName = `${fileName}_full.png`;

            // 截图
            const canvas = await html2canvas($content[0], {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });

            // 复制到剪贴板
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({'image/png': blob})
                    ]);

                    // 同时下载
                    const url = canvas.toDataURL('image/png');
                    downloadImage(url, screenshotName);
                } catch (err) {
                    console.error('复制到剪贴板失败:', err);
                    // 如果复制失败，至少下载
                    const url = canvas.toDataURL('image/png');
                    downloadImage(url, screenshotName);
                }
            });
        } catch (err) {
            console.error('截图失败:', err);
        }
    }

    /**
     * 打印
     */
    function performPrint() {
        const $content = $('#content-actual');
        if ($content.length === 0) return;

        // 获取文件名
        const fileName = getFileName();

        // 创建打印样式
        const printStyles = `
            <style id="print-styles">
                @media print {
                    /* 隐藏所有其他内容 */
                    body > *:not(.print-content) {
                        display: none !important;
                    }
                    
                    .print-content {
                        display: block !important;
                        margin: 0;
                        padding: 0;
                        font-family: Consolas, "Courier New", monospace;
                        font-size: 9px;
                        line-height: 1.1;
                        color: #000;
                    }
                    
                    .print-header {
                        margin-bottom: 8px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #ccc;
                    }
                    
                    .print-header h3 {
                        margin: 0;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    
                    .print-timestamp {
                        font-size: 8px;
                        color: #666;
                        margin: 3px 0;
                    }
                    
                    .content-lines {
                        width: 100%;
                    }
                    
                    .content-line {
                        display: flex;
                        margin-bottom: 0;
                        page-break-inside: avoid;
                        font-size: 9px;
                        position: relative;
                    }
                    
                    .line-number {
                        min-width: 45px;
                        padding-right: 6px;
                        color: #666;
                        text-align: right;
                        border-right: 1px solid #ddd;
                        margin-right: 6px;
                        flex-shrink: 0;
                        position: relative;
                    }
                    
                    .line-text {
                        flex: 1;
                        word-break: break-all;
                        overflow-wrap: break-word;
                    }
                    
                    /* 标记样式 */
                    .content-line.marked .line-number::before {
                        content: '●';
                        color: #ffc107 !important;
                        font-size: 14px;
                        position: absolute;
                        left: -10px;
                        top: 50%;
                        transform: translateY(-50%);
                    }
                    
                    /* 搜索高亮 */
                    mark.search-hit {
                        background-color: #ffeb3b !important;
                        padding: 0 2px;
                        color: #000 !important;
                    }
                    
                    /* 自定义高亮 */
                    mark.custom-highlight {
                        background: linear-gradient(120deg, #a8e6cf 0%, #dcedc1 100%) !important;
                        border-radius: 3px;
                        padding: 1px 3px;
                        color: #2d5016 !important;
                        font-weight: 500;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    }
                    
                                        /* 语法高亮样式 */
                    .viewer-keyword { color: #0000ff !important; font-weight: bold; }
                    .viewer-string { color: #008000 !important; }
                    .viewer-number { color: #ff6600 !important; }
                    .viewer-comment { color: #808080 !important; font-style: italic; }
                    .viewer-error { color: #ff0000 !important; font-weight: bold; }
                    .viewer-warning { color: #ff8c00 !important; }
                    .viewer-info { color: #0080ff !important; }
                    .viewer-debug { color: #808080 !important; }
                    .viewer-timestamp { color: #666666 !important; }
                    .viewer-level { font-weight: bold; }
                    .viewer-level.ERROR { color: #ff0000 !important; }
                    .viewer-level.WARN { color: #ff8c00 !important; }
                    .viewer-level.INFO { color: #0080ff !important; }
                    .viewer-level.DEBUG { color: #808080 !important; }
                    
                    @page {
                        margin: 0.5cm;
                        size: A4 landscape;
                    }
                }
            </style>
        `;

        // 创建打印内容 - 包含当前分页的所有内容
        const printContent = `
            <div class="print-content" style="display: none;">
                <div class="print-header">
                    <h3>文件: ${fileName}</h3>
                    <div class="print-timestamp">打印时间: ${new Date().toLocaleString()}</div>
                </div>
                ${$content.html()}
            </div>
        `;

        // 添加打印样式和内容到页面
        const $printStyles = $(printStyles);
        const $printContent = $(printContent);

        $('head').append($printStyles);
        $('body').append($printContent);

        if (window.ViewerNotification) {
            // 移除打印通知
        }

        // 延迟一下确保样式加载完成
        setTimeout(() => {
            // 执行打印
            window.print();

            // 打印完成后清理
            setTimeout(() => {
                $printStyles.remove();
                $printContent.remove();
            }, 1000);
        }, 500);
    }

    /**
     * 加载 html2canvas 库
     */
    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof html2canvas !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 下载图片
     */
    function downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 获取文件名（用于截图命名）
     */
    function getFileName() {
        const filePath = window.ViewerUIState ? window.ViewerUIState.getActiveFileName() : null;
        if (!filePath) return 'file';

        // 提取文件名（去除路径和扩展名）
        const parts = filePath.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.[^.]+$/, '');
    }

    /**
     * 清除标记（供外部调用）
     */
    function clearMarks() {
        markedLines.clear();
        updateMarkDisplay();
    }

    return {
        init,
        clearMarks,
        restoreMarks
    };
})();