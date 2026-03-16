package org.fayfoxcat.filelens;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * FileLens文件查看器开发启动类
 * 仅用于开发阶段测试，打包时不会影响其他项目的使用
 */
@SpringBootApplication
public class FileLensApplication {

    public static void main(String[] args) {
        SpringApplication.run(FileLensApplication.class, args);
    }
}
