package org.fayfoxcat.viewer.config;

import org.fayfoxcat.viewer.service.AuthService;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 认证拦截器
 * 拦截需要认证的请求
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService authService;
    private final ViewerProperties properties;

    public AuthInterceptor(AuthService authService, ViewerProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) throws Exception {
        // 如果未启用认证，直接放行
        if (!authService.isAuthEnabled()) {
            return true;
        }

        String uri = request.getRequestURI();
        String endpoint = properties.getEndpoint();

        // 登录相关接口和静态资源不需要认证
        if (uri.equals(endpoint) ||
                uri.startsWith(endpoint + "/auth/") ||
                uri.startsWith(endpoint + "/css/") ||
                uri.startsWith(endpoint + "/js/") ||
                uri.startsWith(endpoint + "/webjars/")) {
            return true;
        }

        // 检查会话认证状态
        if (authService.isAuthenticated(request.getSession())) {
            return true;
        }

        // 未认证，返回401
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"未认证\",\"message\":\"请先登录\"}");
        return false;
    }
}
