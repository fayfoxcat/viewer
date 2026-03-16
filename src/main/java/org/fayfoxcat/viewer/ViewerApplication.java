package org.fayfoxcat.viewer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Viewer文件查看器开发启动类
 * 仅用于开发阶段测试，打包时不会影响其他项目的使用
 */
@SpringBootApplication
public class ViewerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ViewerApplication.class, args);
    }
}
