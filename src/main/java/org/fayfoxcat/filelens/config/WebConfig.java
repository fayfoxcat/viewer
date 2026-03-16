package org.fayfoxcat.filelens.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置类
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

        @Value("${filelens.viewer.endpoint:/filelens}")
    private String fileLensEndpoint;

    private final AuthInterceptor authInterceptor;

    public WebConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    /**
     * 配置静态资源处理器
     * 支持直接访问和带 endpoint 前缀的访问方式
     *
     * @param registry 资源处理器注册表
     */
    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        // 配置静态资源访问路径，直接映射到根路径
        // 这样无论 context-path 是什么，都可以通过 /css/** 访问
        registry.addResourceHandler("/css/**")
                .addResourceLocations("classpath:/static/css/");

        registry.addResourceHandler("/js/**")
                .addResourceLocations("classpath:/static/js/");

                // 同时也支持带 context-path 的访问（兼容性）
        registry.addResourceHandler(fileLensEndpoint + "/css/**")
                .addResourceLocations("classpath:/static/css/");

        registry.addResourceHandler(fileLensEndpoint + "/js/**")
                .addResourceLocations("classpath:/static/js/");
    }

    /**
     * 添加拦截器
     *
     * @param registry 拦截器注册表
     */
    @Override
    @SuppressWarnings("null")
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
                registry.addInterceptor(authInterceptor)
                .addPathPatterns(fileLensEndpoint + "/**");
    }
}
