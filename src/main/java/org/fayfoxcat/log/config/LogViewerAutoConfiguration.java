package org.fayfoxcat.log.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * 日志查看器自动配置类
 * 当应用为 Web 应用时自动启用日志查看器功能
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Configuration
@ConditionalOnWebApplication
@EnableConfigurationProperties({LogViewerProperties.class, LogPatternsProperties.class})
@ComponentScan(basePackages = "org.fayfoxcat.log")
public class LogViewerAutoConfiguration {
    // 自动配置类，无需额外代码
}