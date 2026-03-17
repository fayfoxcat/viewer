package org.fayfoxcat.viewer.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Patterns 配置环境后处理器
 * 自动加载所有 patterns*.yml 配置文件
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class PatternsEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:patterns*.yml");
            Arrays.stream(resources).filter(r -> Objects.nonNull(r.getFilename()))
                    .sorted(Comparator.comparing(Resource::getFilename))
                    .forEach(resource -> loadResource(environment, resource));
        } catch (Exception e) {
            System.err.println("[Viewer] 未能扫描patterns配置文件: " + e.getMessage());
        }
    }

    private void loadResource(ConfigurableEnvironment environment, Resource resource) {
        try {
            String filename = resource.getFilename();
            if (filename == null) {
                return;
            }
            List<PropertySource<?>> propertySources = loader.load(filename, resource);
            if (propertySources != null) {
                for (PropertySource<?> ps : propertySources) {
                    if (ps != null) {
                        environment.getPropertySources().addLast(ps);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[Viewer] patterns配置加载失败: " + resource.getFilename());
        }
    }
}
