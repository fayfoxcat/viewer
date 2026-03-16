package org.fayfoxcat.viewer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 文件模式配置属性类
 * 从 patterns.yml 和 application.yml 中读取合并后的 patterns 配置
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@ConfigurationProperties(prefix = "viewer.patterns")
public class FilePatternsProperties {

    /**
     * 高亮/搜索规则集合（有序）
     * key 为规则标识（如 error、warning），value 为规则详情
     */
    private Map<String, PatternRule> rules = new LinkedHashMap<>();

    /**
     * 预设组合
     * key 为预设标识（如 java-exception），value 为预设详情
     */
    private Map<String, PatternPreset> presets = new LinkedHashMap<>();

    public Map<String, PatternRule> getRules() {
        return rules;
    }

    public void setRules(Map<String, PatternRule> rules) {
        this.rules = rules;
    }

    public Map<String, PatternPreset> getPresets() {
        return presets;
    }

    public void setPresets(Map<String, PatternPreset> presets) {
        this.presets = presets;
    }

    /**
     * 单条模式规则
     */
    public static class PatternRule {
        /**
         * 显示名称
         */
        private String name;
        /**
         * 正则表达式
         */
        private String regex;
        /**
         * 前端 CSS class 名
         */
        private String className;
        /**
         * 高亮颜色
         */
        private String color;
        /**
         * 描述
         */
        private String description;
        /**
         * 是否参与前端语法高亮（true=渲染时自动高亮，false=仅搜索可用）
         */
        private boolean highlight = true;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getRegex() {
            return regex;
        }

        public void setRegex(String regex) {
            this.regex = regex;
        }

        public String getClassName() {
            return className;
        }

        public void setClassName(String className) {
            this.className = className;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public boolean isHighlight() {
            return highlight;
        }

        public void setHighlight(boolean highlight) {
            this.highlight = highlight;
        }
    }

    /**
     * 预设组合
     */
    public static class PatternPreset {
        /**
         * 显示名称
         */
        private String name;
        /**
         * 引用的规则 key 列表
         */
        private List<String> patterns;
        /**
         * 描述
         */
        private String description;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public List<String> getPatterns() {
            return patterns;
        }

        public void setPatterns(List<String> patterns) {
            this.patterns = patterns;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }
}
