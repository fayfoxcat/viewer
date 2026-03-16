package org.fayfoxcat.filelens.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * FileLens文件查看器安全配置类 - Spring Security 适配
 * <p>
 * 根据 enable-auth 配置自动选择安全策略：
 * - enable-auth=false: 允许匿名访问
 * - enable-auth=true: 禁用 Spring Security 默认认证，使用自定义密钥认证
 * <p>
 * 使用 SecurityFilterChain 方式（Spring Security 5.7+）
 * 使用最高优先级确保在主项目的 Security 配置之前执行
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Configuration
@ConditionalOnClass(SecurityFilterChain.class)
@EnableConfigurationProperties(FileLensProperties.class)
public class FileLensSecurityConfig {

    private final FileLensProperties properties;

    public FileLensSecurityConfig(FileLensProperties properties) {
        this.properties = properties;
    }

    @Bean
    @Order(1)  // 最高优先级，确保在主项目的 Security 配置之前执行
    public SecurityFilterChain fileLensSecurityFilterChain(HttpSecurity http) throws Exception {
        String endpoint = properties.getEndpoint();

        http.requestMatchers(matchers -> matchers.antMatchers(endpoint, endpoint + "/**"))
                .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
                .csrf().disable();

        // 当启用认证时，禁用 Spring Security 的默认认证机制
        if (properties.isEnableAuth()) {
            http.formLogin().disable()   // 禁用默认登录表单
                    .httpBasic().disable()   // 禁用 HTTP Basic 认证
                    .logout().disable();     // 禁用默认登出
        }

        return http.build();
    }
}
