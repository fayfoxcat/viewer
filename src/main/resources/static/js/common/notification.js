/**
 * 通知组件
 * 用于显示各种提示信息，支持自定义图标、类型和操作按钮
 */
window.ViewerNotification = (function () {
    'use strict';

    let notificationContainer = null;
    let notificationId = 0;

    /**
     * 初始化通知容器
     * 在页面中创建通知容器元素
     */
    function init() {
        if (!notificationContainer) {
            notificationContainer = $('<div class="notification-container"></div>');
            $('body').append(notificationContainer);
        }
    }

    /**
     * 显示通知
     *
     * @param {Object} options - 通知选项
     * @param {string} [options.icon='ℹ️'] - 通知图标
     * @param {string} [options.message=''] - 通知消息
     * @param {string} [options.type='info'] - 通知类型：info, success, warning, error
     * @param {number} [options.duration=3000] - 显示时长（毫秒），0 表示不自动关闭
     * @param {Array} [options.actions=[]] - 操作按钮数组
     * @returns {number} 通知 ID
     */
    function show(options) {
        init();

        const id = ++notificationId;
        const {
            icon = 'ℹ️',
            message = '',
            type = 'info',
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

        $notification.find('.notification-close').on('click', () => {
            close(id);
        });

        $notification.find('.notification-btn').on('click', function () {
            const actionIndex = $(this).data('action');
            if (actions[actionIndex] && actions[actionIndex].onClick) {
                actions[actionIndex].onClick();
            }
            close(id);
        });

        notificationContainer.append($notification);

        setTimeout(() => {
            $notification.addClass('show');
        }, 10);

        if (duration > 0) {
            setTimeout(() => {
                close(id);
            }, duration);
        }

        return id;
    }

    /**
     * 关闭通知
     *
     * @param {number} id - 通知 ID
     */
    function close(id) {
        const $notification = notificationContainer.find(`[data-id="${id}"]`);
        $notification.removeClass('show');
        setTimeout(() => {
            $notification.remove();
        }, 300);
    }

    /**
     * 显示文件修改通知
     *
     * @returns {number} 通知 ID
     */
    function showFileModified() {
        return show({
            icon: '⚠️',
            message: '文件已被修改，缓存已清空',
            type: 'warning',
            duration: 5000
        });
    }

    return {
        show,
        showFileModified,
    };
})();
