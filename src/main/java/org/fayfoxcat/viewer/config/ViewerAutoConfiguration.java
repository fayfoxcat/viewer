package org.fayfoxcat.viewer.config;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.core.io.support.PropertySourceFactory;
import org.springframework.lang.NonNull;

import javax.annotation.PostConstruct;
import java.util.Properties;

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
@PropertySource(value = "classpath:patterns.yml", factory = ViewerAutoConfiguration.YamlPropertySourceFactory.class)
public class ViewerAutoConfiguration {

    private final FilePatternsProperties patternsProperties;

    public ViewerAutoConfiguration(FilePatternsProperties patternsProperties) {
        this.patternsProperties = patternsProperties;
    }

    @PostConstruct
    public void init() {
        int rulesCount = patternsProperties.getRules() != null ? patternsProperties.getRules().size() : 0;
        int presetsCount = patternsProperties.getPresets() != null ? patternsProperties.getPresets().size() : 0;
        System.out.println("[Viewer] 加载模式配置: " + rulesCount + " 规则, " + presetsCount + " 预设");
    }

    /**
     * YAML 属性源工厂
     * 用于支持 @PropertySource 注解加载 YAML 配置文件
     */
    public static class YamlPropertySourceFactory implements PropertySourceFactory {

        @Override
        @NonNull
        public PropertiesPropertySource createPropertySource(String name, @NonNull EncodedResource resource) {
            YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
            factory.setResources(resource.getResource());

            Properties properties = factory.getObject();
            if (properties == null) {
                properties = new Properties();
            }

            String sourceName = name != null ? name : resource.getResource().getFilename();
            if (sourceName == null) {
                sourceName = "yamlPropertySource";
            }

            return new PropertiesPropertySource(sourceName, properties);
        }
    }
}