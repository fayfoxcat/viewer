package org.fayfoxcat.viewer.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * Viewer文件查看器自动配置类
 * 当应用为 Web 应用时自动启用文件查看器功能
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Configuration
@ConditionalOnWebApplication
@EnableConfigurationProperties({ViewerProperties.class, FilePatternsProperties.class})
@ComponentScan(basePackages = "org.fayfoxcat.viewer")
public class ViewerAutoConfiguration {
    // 自动配置类，无需额外代码
}