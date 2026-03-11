/**
 * 通知组件
 * 用于显示各种提示信息
 */
window.LogViewerNotification = (function() {
    'use strict';

    let notificationContainer = null;
    let notificationId = 0;

    /**
     * 初始化
     */
    function init() {
        if (!notificationContainer) {
            notificationContainer = $('<div class="notification-container"></div>');
            $('body').append(notificationContainer);
        }
    }

    /**
     * 显示通知
     */
    function show(options) {
        init();

        const id = ++notificationId;
        const {
            icon = 'ℹ️',
            message = '',
            type = 'info', // info | success | warning | error
            duration = 3000,
            actions = []
        } = options;

        const $notification = $(`
            <div class="notification notification-${type}" data-id="${id}">
                <div class="notification-content">
                    <span class="notification-icon">${icon}</span>
                    <span class="notification-message">${message}</span>
                </div>
                ${actions.length > 0 ? `
                    <div class="notification-actions">
                        ${actions.map((action, index) => `
                            <button class="notification-btn" data-action="${index}">
                                ${action.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
                <button class="notification-close">✕</button>
            </div>
        `);

        // 绑定事件
        $notification.find('.notification-close').on('click', () => {
            close(id);
        });

        $notification.find('.notification-btn').on('click', function() {
            const actionIndex = $(this).data('action');
            if (actions[actionIndex] && actions[actionIndex].onClick) {
                actions[actionIndex].onClick();
            }
            close(id);
        });

        // 添加到容器
        notificationContainer.append($notification);

        // 淡入动画
        setTimeout(() => {
            $notification.addClass('show');
        }, 10);

        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                close(id);
            }, duration);
        }

        return id;
    }

    /**
     * 关闭通知
     */
    function close(id) {
        const $notification = notificationContainer.find(`[data-id="${id}"]`);
        $notification.removeClass('show');
        setTimeout(() => {
            $notification.remove();
        }, 300);
    }

    /**
     * 显示文件追加通知
     */
    function showFileAppend(newLines) {
        return show({
            icon: '📝',
            message: `文件已更新，新增 ${newLines} 行`,
            type: 'success',
            duration: 3000
        });
    }

    /**
     * 显示文件修改通知
     */
    function showFileModified() {
        return show({
            icon: '⚠️',
            message: '文件已被修改，缓存已清空',
            type: 'warning',
            duration: 5000
        });
    }

    /**
     * 显示跳转询问
     */
    function showJumpToLatest(onConfirm) {
        return show({
            icon: '🔄',
            message: '检测到新内容，是否跳转到最新？',
            type: 'info',
            duration: 0,
            actions: [
                { text: '跳转', onClick: onConfirm },
                { text: '稍后', onClick: () => {} }
            ]
        });
    }

    // 公开接口
    return {
        show,
        close,
        showFileAppend,
        showFileModified,
        showJumpToLatest
    };
})();
