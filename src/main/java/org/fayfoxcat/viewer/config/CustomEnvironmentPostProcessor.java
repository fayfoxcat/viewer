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

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

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
        List<String> propertiesList = Arrays.asList("application-viewer.yml", "patterns.yml");
        loadPatterns(resolver, environment, propertiesList);
    }

    /**
     * 加载 application-viewer.yml 配置文件
     */
    private void loadPatterns(ResourcePatternResolver resolver, ConfigurableEnvironment environment, List<String> configs) {
        try {
            MutablePropertySources sources = environment.getPropertySources();
            List<Resource> resources = configs.stream().map(config->
                    resolver.getResource("classpath:"+config)).collect(Collectors.toList());
            for (Resource resource : resources) {
                List<PropertySource<?>> propertySources = loader.load(resource.getFilename(), resource);
                propertySources.forEach(sources::addLast);
            }
        } catch (Exception e) {
            System.err.println("[Viewer] 加载配置失败：" + e.getMessage());
        }
    }
}
