package org.fayfoxcat.filelens.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.io.File;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * FileLens文件查看器配置属性类
 * 用于从 application.yml 中读取配置
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@ConfigurationProperties(prefix = "filelens.viewer")
public class FileLensProperties {

    /**
     * 允许访问的文件目录列表（白名单）
     * 只有在此列表中的目录才能被访问
     * 如果为空，则默认使用当前jar包运行路径
     */
    private List<String> paths = new ArrayList<>();

    /**
     * 文件查看器的访问端点
     * 默认为 /filelens
     */
    private String endpoint = "/filelens";

    /**
     * 是否启用权限控制
     * 默认为 true，设置为 false 时跳过权限验证
     */
    private boolean enableAuth = true;

    /**
     * 认证密钥
     * 如果配置了此密钥，登录时需要输入此密钥
     * 如果未配置，系统会生成临时密钥并打印到日志
     */
    private String secretKey;

    /**
     * 大文件阈值（单位：MB）
     * 此配置已废弃，所有文件均采用分页加载模式
     * 默认为 1000MB
     */
    private int maxFileSizeMb = 1000;

    /**
     * 大文件显示行数
     * 此配置已废弃，所有文件均采用分页加载模式
     * 默认为 10000 行
     */
    private int tailLines = 10000;


    public List<String> getPaths() {
        return paths;
    }

    public void setPaths(List<String> paths) {
        this.paths = paths;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public boolean isEnableAuth() {
        return enableAuth;
    }

    public void setEnableAuth(boolean enableAuth) {
        this.enableAuth = enableAuth;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public int getMaxFileSizeMb() {
        return maxFileSizeMb;
    }

    public void setMaxFileSizeMb(int maxFileSizeMb) {
        this.maxFileSizeMb = maxFileSizeMb;
    }

    public int getTailLines() {
        return tailLines;
    }

    public void setTailLines(int tailLines) {
        this.tailLines = tailLines;
    }

    /**
     * 获取有效的文件路径列表
     * 如果用户配置了路径，则使用用户配置的路径
     * 如果用户没有配置路径，则返回当前jar包运行路径
     *
     * @return 有效的文件路径列表
     */
    public List<String> getEffectivePaths() {
        if (paths != null && !paths.isEmpty()) {
            return paths;
        }

        // 如果没有配置路径，返回当前jar包运行路径
        List<String> defaultPaths = new ArrayList<>();
        String jarPath = getJarRunningPath();
        if (jarPath != null && !jarPath.isEmpty()) {
            defaultPaths.add(jarPath);
        }
        return defaultPaths;
    }

    /**
     * 获取当前jar包运行路径
     * 优先使用主进程的运行路径（user.dir），这样作为依赖时会使用主进程所在路径
     *
     * @return jar包运行路径
     */
    private String getJarRunningPath() {
        try {
            // 优先使用 user.dir，这是主进程的工作目录
            // 无论是独立运行还是作为依赖运行，都会返回主进程jar包所在路径
            String userDir = System.getProperty("user.dir");
            if (userDir != null && !userDir.trim().isEmpty()) {
                return userDir;
            }

            // 如果 user.dir 获取失败，尝试通过类路径获取
            String path = this.getClass().getProtectionDomain().getCodeSource().getLocation().getPath();
            path = URLDecoder.decode(path, StandardCharsets.UTF_8.name());

            File file = new File(path);
            if (file.isFile()) {
                return file.getParent();
            }
            return file.getAbsolutePath();
        } catch (Exception e) {
            // 最后的兜底方案
            return System.getProperty("user.home");
        }
    }
}