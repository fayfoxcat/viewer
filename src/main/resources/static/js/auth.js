/**
 * 认证模块
 */
window.LogViewerAuth = (function() {
    'use strict';

    let apiBase = '';

    /**
     * 显示登录错误信息
     */
    function showLoginError(message) {
        $('#login-error').text(message).show();
        setTimeout(function() {
            $('#login-error').fadeOut();
        }, 3000);
    }

    /**
     * 初始化认证
     */
    function init(apiBasePath) {
        apiBase = apiBasePath;
        
        const authEnabled = $('body').attr('data-auth-enabled') === 'true';
        const authenticated = $('body').attr('data-authenticated') === 'true';
        
        // 检查是否需要显示登录界面
        if (authEnabled && !authenticated) {
            $('#login-overlay').show();
            
            // 登录按钮点击事件
            $('#login-btn').click(function() {
                const authKey = $('#auth-key-input').val().trim();
                if (!authKey) {
                    showLoginError('请输入认证密钥');
                    return;
                }
                
                $.ajax({
                    url: apiBase + '/auth/login',
                    method: 'POST',
                    data: { authKey: authKey },
                    success: function(response) {
                        if (response.success) {
                            $('#login-overlay').hide();
                            location.reload();
                        } else {
                            showLoginError(response.message || '登录失败');
                        }
                    },
                    error: function() {
                        showLoginError('登录请求失败，请重试');
                    }
                });
            });
            
            // 回车登录
            $('#auth-key-input').keypress(function(e) {
                if (e.which === 13) {
                    $('#login-btn').click();
                }
            });
            
            return false; // 阻止后续初始化
        }
        
        return true; // 允许继续初始化
    }

    // 公开接口
    return {
        init
    };
})();