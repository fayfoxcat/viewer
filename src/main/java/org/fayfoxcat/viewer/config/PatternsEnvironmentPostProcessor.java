package org.fayfoxcat.viewer.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Viewer Patterns 配置环境后处理器
 * 在应用启动时自动加载所有 patterns*.yml 配置文件
 * 工作原理：
 * 1. 在 Spring Boot 环境准备阶段执行
 * 2. 扫描 classpath 下所有 patterns*.yml 文件
 * 3. 按文件名排序后依次加载到 Environment
 * 4. 后加载的文件中的同名配置会覆盖先加载的
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class PatternsEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        try {
            ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            // 扫描所有 patterns*.yml 文件
            Resource[] resources = resolver.getResources("classpath*:patterns*.yml");

            if (resources.length == 0) {
                System.out.println("[Viewer] No patterns*.yml files found in classpath");
                return;
            }

            // 按文件名排序，确保加载顺序一致
            Arrays.sort(resources, Comparator.comparing(r -> {
                try {
                    String filename = r.getFilename();
                    return filename != null ? filename : "";
                } catch (Exception e) {
                    return "";
                }
            }));

            List<String> loadedFiles = new ArrayList<>();

            // 依次加载每个配置文件
            for (Resource resource : resources) {
                try {
                    String filename = resource.getFilename();
                    if (filename == null) {
                        continue;
                    }

                    // 使用 YamlPropertySourceLoader 加载 YAML 文件
                    List<PropertySource<?>> propertySources = loader.load(filename, resource);

                    // 将加载的 PropertySource 添加到 Environment
                    if (propertySources != null) {
                        for (PropertySource<?> propertySource : propertySources) {
                            if (propertySource != null) {
                                environment.getPropertySources().addLast(propertySource);
                            }
                        }
                    }

                    loadedFiles.add(filename);
                } catch (Exception e) {
                    System.err.println("[Viewer] Failed to load patterns file: " + resource.getFilename() + ", error: " + e.getMessage());
                }
            }

            if (!loadedFiles.isEmpty()) {
                System.out.println("[Viewer] Loaded patterns files: " + String.join(", ", loadedFiles));
            }

        } catch (Exception e) {
            System.err.println("[Viewer] Failed to scan patterns files: " + e.getMessage());
        }
    }
}
