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
 * 配置环境后处理器
 * 自动加载所有 *.yml 配置文件
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
public class CustomEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        try {
            ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver(
                    application.getClassLoader()
            );
            
            // 扫描所有 *.yml 文件
            Resource[] resources = resolver.getResources("classpath*:*.yml");
            
            System.out.println("[Viewer] Found " + resources.length + " *.yml files");
            
            if (resources.length == 0) {
                System.out.println("[Viewer] No *.yml files found, trying fallback...");
                // 尝试直接加载 patterns.yml
                try {
                    Resource fallback = resolver.getResource("classpath:patterns.yml");
                    if (fallback.exists()) {
                        resources = new Resource[]{fallback};
                        System.out.println("[Viewer] Loaded fallback patterns.yml");
                    }
                } catch (Exception e) {
                    System.err.println("[Viewer] Fallback also failed: " + e.getMessage());
                }
            }
            
            if (resources.length == 0) {
                return;
            }

            // 按文件名排序
            Arrays.sort(resources, Comparator.comparing(r -> {
                try {
                    return r.getFilename() != null ? r.getFilename() : "";
                } catch (Exception e) {
                    return "";
                }
            }));

            List<String> loadedFiles = new ArrayList<>();
            
            // 加载每个资源
            for (Resource resource : resources) {
                try {
                    String filename = resource.getFilename();
                    if (filename == null) {
                        continue;
                    }
                    
                    System.out.println("[Viewer] Loading: " + filename + " from " + resource.getURL());
                    
                    List<PropertySource<?>> propertySources = loader.load(filename, resource);
                    if (propertySources != null && !propertySources.isEmpty()) {
                        for (PropertySource<?> ps : propertySources) {
                            if (ps != null) {
                                environment.getPropertySources().addLast(ps);
                                System.out.println("[Viewer] Added PropertySource: " + ps.getName() + " with " + ps.getSource().getClass().getSimpleName());
                            }
                        }
                        loadedFiles.add(filename);
                    }
                } catch (Exception e) {
                    System.err.println("[Viewer] Failed to load: " + resource.getFilename() + ", error: " + e.getMessage());
                }
            }

            if (!loadedFiles.isEmpty()) {
                System.out.println("[Viewer] Successfully loaded patterns files: " + String.join(", ", loadedFiles));
            } else {
                System.err.println("[Viewer] No patterns files were successfully loaded!");
            }

        } catch (Exception e) {
            System.err.println("[Viewer] Failed to scan patterns files: " + e.getMessage());
        }
    }
}
