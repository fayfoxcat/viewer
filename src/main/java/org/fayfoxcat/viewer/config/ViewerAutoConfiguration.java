package org.fayfoxcat.viewer.config;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.PropertySourceFactory;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Properties;

/**
 * Viewer文件查看器自动配置类
 * 当应用为 Web 应用时自动启用文件查看器功能
 * 支持自动加载所有 patterns*.yml 配置文件
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Configuration
@ConditionalOnWebApplication
@EnableConfigurationProperties({ViewerProperties.class, FilePatternsProperties.class})
@ComponentScan(basePackages = "org.fayfoxcat.viewer")
@PropertySource(value = "classpath:patterns.yml", factory = ViewerAutoConfiguration.YamlPropertySourceFactory.class)
public class ViewerAutoConfiguration {

    /**
     * YAML 属性源工厂
     * 用于支持 @PropertySource 注解加载 YAML 配置文件
     * 支持加载多个 patterns*.yml 文件
     */
    public static class YamlPropertySourceFactory implements PropertySourceFactory {

        @Override
        @NonNull
        @SuppressWarnings("null")
        public PropertiesPropertySource createPropertySource(@Nullable String name, @NonNull EncodedResource resource) {
            // 尝试加载所有 patterns*.yml 文件
            List<Resource> allResources = new ArrayList<>();

            try {
                // 搜索 classpath 下所有 patterns*.yml 文件
                ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
                Resource[] resources = resolver.getResources("classpath*:patterns*.yml");

                if (resources.length > 0) {
                    allResources.addAll(Arrays.asList(resources));
                } else {
                    allResources.add(resource.getResource());
                }
            } catch (Exception e) {
                allResources.add(resource.getResource());
            }

            YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
            Resource[] resourceArray = allResources.toArray(new Resource[0]);
            factory.setResources(resourceArray);

            Properties properties = factory.getObject();
            if (properties == null) {
                properties = new Properties();
            }
            String sourceName = name != null ? name : "patterns";
            return new PropertiesPropertySource(sourceName, properties);
        }
    }
}
