package org.fayfoxcat.viewer.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.util.List;

/**
 * Viewer 配置环境后处理器
 * 自动加载 application-viewer.yml 和所有 patterns*.yml 配置文件
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class CustomEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver(application.getClassLoader());
        loadApplicationViewer(resolver, environment);
        loadPatterns(resolver, environment);
    }

    /**
     * 加载 application-viewer.yml 配置文件
     */
    private void loadApplicationViewer(ResourcePatternResolver resolver, ConfigurableEnvironment environment) {
        try {
            Resource resource = resolver.getResource("classpath:application-viewer.yml");
            if (resource.exists()) {
                MutablePropertySources sources = environment.getPropertySources();
                List<PropertySource<?>> propertySources = loader.load("application-viewer.yml", resource);
                propertySources.forEach(sources::addLast);
            }
        } catch (Exception e) {
            System.err.println("[Viewer]加载 application-viewer.yml文件失败：" + e.getMessage());
        }
    }

    /**
     * 加载 patterns*.yml 配置文件
     */
    private void loadPatterns(ResourcePatternResolver resolver, ConfigurableEnvironment environment) {
        try {
            Resource[] resources = resolver.getResources("classpath*:patterns*.yml");

            if (resources.length == 0) {
                Resource fallback = resolver.getResource("classpath:patterns.yml");
                if (fallback.exists()) {
                    resources = new Resource[]{fallback};
                }
            }

            MutablePropertySources sources = environment.getPropertySources();
            for (Resource resource : resources) {
                List<PropertySource<?>> propertySources = loader.load(resource.getFilename(), resource);
                propertySources.forEach(sources::addLast);
            }
        } catch (Exception e) {
            System.err.println("[Viewer] 加载 patterns* 配置失败：" + e.getMessage());
        }
    }
}
