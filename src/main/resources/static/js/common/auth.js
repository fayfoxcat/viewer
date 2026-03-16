/**
 * 认证模块
 * 负责用户认证和登录流程
 */
window.LogViewerAuth = (function () {
    'use strict';

    let apiBase = '';

    /**
     * 显示登录错误信息
     * 显示错误提示并在3秒后自动隐藏
     *
     * @param {string} message - 错误信息
     */
    function showLoginError(message) {
        $('#login-error').text(message).show();
        setTimeout(function () {
            $('#login-error').fadeOut();
        }, 3000);
    }

    /**
     * 初始化认证模块
     * 检查认证状态，如果需要认证则显示登录界面
     *
     * @param {string} apiBasePath - API 基础路径
     * @returns {boolean} 是否已认证或无需认证
     */
    function init(apiBasePath) {
        apiBase = apiBasePath;

        const authEnabled = $('body').attr('data-auth-enabled') === 'true';
        const authenticated = $('body').attr('data-authenticated') === 'true';

        if (authEnabled && !authenticated) {
            $('#login-overlay').show();

            $('#login-btn').click(function () {
                const authKey = $('#auth-key-input').val().trim();
                if (!authKey) {
                    showLoginError('请输入认证密钥');
                    return;
                }

                $.ajax({
                    url: apiBase + '/auth/login',
                    method: 'POST',
                    data: {authKey: authKey},
                    success: function (response) {
                        if (response.success) {
                            $('#login-overlay').hide();
                            location.reload();
                        } else {
                            showLoginError(response.message || '登录失败');
                        }
                    },
                    error: function () {
                        showLoginError('登录请求失败，请重试');
                    }
                });
            });

            $('#auth-key-input').keypress(function (e) {
                if (e.which === 13) {
                    $('#login-btn').click();
                }
            });

            return false;
        }

        return true;
    }

    return {
        init
    };
})();
