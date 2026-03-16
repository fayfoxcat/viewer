package org.fayfoxcat.viewer.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Viewer文件查看器通用权限绕过过滤器
 * 当 enable-auth=false 时，为文件查看器请求设置标记，供各种权限框架识别
 * 适用于：
 * - Spring Security
 * - 自定义 Filter/Interceptor
 * - Shiro
 * - Sa-Token
 * - 其他任何权限框架
 * 使用最高优先级确保在所有权限验证之前执行
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Component
@ConditionalOnProperty(prefix = "viewer.viewer", name = "enable-auth", havingValue = "false")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ViewerUniversalFilter extends OncePerRequestFilter {

    private final ViewerProperties properties;

    public ViewerUniversalFilter(ViewerProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        // 获取请求路径
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty()) {
            requestURI = requestURI.substring(contextPath.length());
        }

        String endpoint = properties.getEndpoint();

        // 判断是否是文件查看器的请求
        if (isViewerPath(requestURI, endpoint)) {
            // 设置多个标记，供不同的权限框架识别
            request.setAttribute("viewer_SKIP_AUTH", Boolean.TRUE);
            request.setAttribute("SKIP_AUTH", Boolean.TRUE);
            request.setAttribute("NO_AUTH_REQUIRED", Boolean.TRUE);

            // 设置一个自定义 Header，供 Filter 识别
            request.setAttribute("X-Viewer-Bypass", "true");
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 判断请求路径是否属于文件查看器
     */
    private boolean isViewerPath(String requestURI, String endpoint) {
        // 精确匹配或前缀匹配文件查看器端点
        return requestURI.equals(endpoint) || requestURI.startsWith(endpoint + "/");
    }
}
