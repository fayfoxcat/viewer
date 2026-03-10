package org.fayfoxcat.log.controller;

import org.fayfoxcat.log.config.LogViewerProperties;
import org.fayfoxcat.log.service.LogViewerService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipOutputStream;

/**
 * 日志查看器控制器
 * 处理日志查看相关的HTTP请求
 */
@Controller
@RequestMapping("${logs.viewer.endpoint:/logs}")
public class LogViewerController {

    private final LogViewerProperties properties;
    private final LogViewerService logViewerService;

    public LogViewerController(LogViewerProperties properties, LogViewerService logViewerService) {
        this.properties = properties;
        this.logViewerService = logViewerService;
    }

    /**
     * 首页
     * @param model 模型
     * @return 日志查看器页面
     */
    @GetMapping
    public String index(Model model) {
        model.addAttribute("paths", properties.getEffectivePaths());
        model.addAttribute("endpoint", properties.getEndpoint());
        return "index";
    }

    /**
     * 列出指定路径下的文件
     * @param path 路径
     * @return 文件列表
     */
    @GetMapping("/files")
    @ResponseBody
    public List<LogViewerService.FileInfo> listFiles(@RequestParam String path) {
        return logViewerService.listFiles(path);
    }

    /**
     * 在指定根路径下递归搜索文件名
     * @param rootPath 根路径
     * @param keyword 关键字
     * @return 匹配到的文件列表
     */
    @GetMapping("/files/search")
    @ResponseBody
    public List<LogViewerService.FileInfo> searchFiles(@RequestParam String rootPath,
                                                       @RequestParam String keyword) {
        return logViewerService.searchFiles(rootPath, keyword);
    }

    /**
     * 列出压缩文件中的文件
     * @param zipPath 压缩文件路径
     * @return 压缩文件中的文件列表
     * @throws IOException IO异常
     */
    @GetMapping("/zip/files")
    @ResponseBody
    public List<LogViewerService.FileInfo> listFilesInZip(@RequestParam String zipPath,
                                                          @RequestParam(required = false, defaultValue = "") String prefix) throws IOException {
        return logViewerService.listFilesInZip(zipPath, prefix);
    }

    /**
     * 获取文件内容
     * @param filePath 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    @GetMapping("/file/content")
    @ResponseBody
    public String getFileContent(@RequestParam String filePath) throws IOException {
        return logViewerService.readFileContent(filePath);
    }

    /**
     * 获取压缩文件中的文件内容
     * @param zipPath 压缩文件路径
     * @param entryName 压缩文件中的文件名称
     * @return 文件内容
     * @throws IOException IO异常
     */
    @GetMapping("/zip/file/content")
    @ResponseBody
    public String getFileFromZip(@RequestParam String zipPath, @RequestParam String entryName) throws IOException {
        return logViewerService.readFileFromZip(zipPath, entryName);
    }

    /**
     * 搜索文件内容
     * @param filePath 文件路径
     * @param keyword 搜索关键词
     * @param useRegex 是否使用正则表达式
     * @return 搜索结果
     * @throws IOException IO异常
     */
    @PostMapping("/file/search")
    @ResponseBody
    public List<String> searchFileContent(@RequestParam String filePath, 
                                          @RequestParam String keyword,
                                          @RequestParam(defaultValue = "false") boolean useRegex) throws IOException {
        return logViewerService.searchFileContent(filePath, keyword, useRegex);
    }

    /**
     * 下载文件
     * @param files 文件路径列表
     * @param response HTTP响应
     * @return 响应实体
     * @throws IOException IO异常
     */
    @PostMapping("/download")
    public ResponseEntity<?> downloadFiles(@RequestParam(value = "files") List<String> files, HttpServletResponse response) throws IOException {
        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (files.size() == 1) {
            String id = files.get(0);
            if (id == null || id.trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            // 压缩包内文件：zipPath!entryName
            if (id.contains("!")) {
                int idx = id.indexOf('!');
                String zipPath = id.substring(0, idx);
                String entryName = id.substring(idx + 1).replace('\\', '/');
                if (!logViewerService.isPathAllowedForViewer(zipPath)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }

                String downloadName = entryName;
                if (downloadName.contains("/")) {
                    downloadName = downloadName.substring(downloadName.lastIndexOf("/") + 1);
                }
                if (downloadName.trim().isEmpty()) {
                    downloadName = "download.log";
                }

                response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
                response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + URLEncoder.encode(downloadName, StandardCharsets.UTF_8.name()));

                try (OutputStream os = response.getOutputStream()) {
                    if (zipPath.toLowerCase(Locale.ROOT).endsWith(".gz")) {
                        String content = logViewerService.readFileFromZip(zipPath, entryName);
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                    } else {
                        try (java.util.zip.ZipFile zipFile = new java.util.zip.ZipFile(zipPath)) {
                            java.util.zip.ZipEntry entry = zipFile.getEntry(entryName);
                            if (entry == null || entry.isDirectory()) {
                                response.setStatus(HttpStatus.NOT_FOUND.value());
                                return null;
                            }
                            try (InputStream is = zipFile.getInputStream(entry)) {
                                byte[] buffer = new byte[8192];
                                int len;
                                while ((len = is.read(buffer)) > 0) {
                                    os.write(buffer, 0, len);
                                }
                            }
                        }
                    }
                    os.flush();
                }
                return null;
            }

            // 单个普通文件直接下载
            File file = new File(id);
            if (!logViewerService.isPathAllowedForViewer(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            if (file.exists() && file.isFile()) {
                FileSystemResource resource = new FileSystemResource(file);
                HttpHeaders headers = new HttpHeaders();
                headers.add(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + URLEncoder.encode(file.getName(), StandardCharsets.UTF_8.name()));
                return ResponseEntity.ok()
                        .headers(headers)
                        .contentLength(file.length())
                        .contentType(MediaType.parseMediaType(MediaType.APPLICATION_OCTET_STREAM_VALUE))
                        .body(resource);
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        // 多个文件：zip 打包下载（Windows 更友好）
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd_HHmmss");
        String zipFileName = sdf.format(new Date()) + ".zip";
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=" + URLEncoder.encode(zipFileName, StandardCharsets.UTF_8.name()));

        Map<String, Integer> nameCounter = new HashMap<>();
        byte[] buffer = new byte[8192];

        try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream(), StandardCharsets.UTF_8)) {
            for (String id : files) {
                if (id == null || id.trim().isEmpty()) continue;

                if (id.contains("!")) {
                    int idx = id.indexOf('!');
                    String zipPath = id.substring(0, idx);
                    String entryName = id.substring(idx + 1).replace('\\', '/');
                    if (!logViewerService.isPathAllowedForViewer(zipPath)) {
                        continue;
                    }
                    String baseName = entryName.contains("/") 
                        ? entryName.substring(entryName.lastIndexOf("/") + 1) 
                        : entryName;
                    if (baseName.trim().isEmpty()) {
                        baseName = "download.log";
                    }
                    String finalName = dedupeName(baseName, nameCounter);

                    zos.putNextEntry(new java.util.zip.ZipEntry(finalName));
                    if (zipPath.toLowerCase(Locale.ROOT).endsWith(".gz")) {
                        String content = logViewerService.readFileFromZip(zipPath, entryName);
                        zos.write(content.getBytes(StandardCharsets.UTF_8));
                    } else {
                        try (java.util.zip.ZipFile zipFile = new java.util.zip.ZipFile(zipPath)) {
                            java.util.zip.ZipEntry entry = zipFile.getEntry(entryName);
                            if (entry != null && !entry.isDirectory()) {
                                try (InputStream is = zipFile.getInputStream(entry)) {
                                    int len;
                                    while ((len = is.read(buffer)) > 0) {
                                        zos.write(buffer, 0, len);
                                    }
                                }
                            }
                        }
                    }
                    zos.closeEntry();
                } else {
                    File file = new File(id);
                    if (!logViewerService.isPathAllowedForViewer(id)) {
                        continue;
                    }
                    if (!file.exists() || !file.isFile()) continue;
                    String finalName = dedupeName(file.getName(), nameCounter);
                    zos.putNextEntry(new java.util.zip.ZipEntry(finalName));
                    try (InputStream is = new FileInputStream(file)) {
                        int len;
                        while ((len = is.read(buffer)) > 0) {
                            zos.write(buffer, 0, len);
                        }
                    }
                    zos.closeEntry();
                }
            }
            zos.finish();
        }

        return null;
    }

    private static String dedupeName(String baseName, Map<String, Integer> counter) {
        String name = baseName;
        int n = counter.getOrDefault(name, 0);
        if (n == 0) {
            counter.put(name, 1);
            return name;
        }
        counter.put(name, n + 1);
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            return name.substring(0, dot) + " (" + n + ")" + name.substring(dot);
        }
        return name + " (" + n + ")";
    }
}