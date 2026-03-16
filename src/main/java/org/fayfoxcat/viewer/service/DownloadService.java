package org.fayfoxcat.viewer.service;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipOutputStream;

/**
 * 下载服务
 * 处理文件的下载和打包下载逻辑，解耦控制器中的 IO 操作
 */
@Service
public class DownloadService {

        private final ViewerService viewerService;

    public DownloadService(ViewerService viewerService) {
        this.viewerService = viewerService;
    }

    /**
     * 下载单个文件
     *
     * @param id       文件ID
     * @param response HTTP响应
     * @return 响应实体
     * @throws IOException IO异常
     */
    public ResponseEntity<?> downloadSingleFile(String id, HttpServletResponse response) throws IOException {
        if (id == null || id.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (id.contains("!")) {
            return downloadZipEntry(id, response);
        }

        File file = new File(id);
        if (!viewerService.isPathAllowedForViewer(id) || !file.exists() || !file.isFile()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

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

    /**
     * 下载压缩包内的文件
     *
     * @param id       文件ID（格式：zipPath!entryName）
     * @param response HTTP响应
     * @return 响应实体
     * @throws IOException IO异常
     */
    private ResponseEntity<?> downloadZipEntry(String id, HttpServletResponse response) throws IOException {
        int idx = id.indexOf('!');
        String zipPath = id.substring(0, idx);
        String entryName = id.substring(idx + 1).replace('\\', '/');

        if (!viewerService.isPathAllowedForViewer(zipPath)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String downloadName = entryName.contains("/") ?
                entryName.substring(entryName.lastIndexOf("/") + 1) : entryName;
        if (downloadName.trim().isEmpty()) {
            downloadName = "download.log";
        }

        response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=" + URLEncoder.encode(downloadName, StandardCharsets.UTF_8.name()));

        try (OutputStream os = response.getOutputStream()) {
            if (zipPath.toLowerCase(Locale.ROOT).endsWith(".gz")) {
                String content = viewerService.readFileFromZip(zipPath, entryName);
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

    /**
     * 下载多个文件（打包为ZIP）
     *
     * @param files    文件列表
     * @param response HTTP响应
     * @return 响应实体
     * @throws IOException IO异常
     */
    public ResponseEntity<?> downloadMultipleFiles(List<String> files, HttpServletResponse response) throws IOException {
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
                    addZipEntryToArchive(id, zos, nameCounter, buffer);
                } else {
                    addFileToArchive(id, zos, nameCounter, buffer);
                }
            }
            zos.finish();
        }
        return null;
    }

    /**
     * 将压缩包内的文件添加到归档
     *
     * @param id          文件ID
     * @param zos         ZIP输出流
     * @param nameCounter 文件名计数器
     * @param buffer      缓冲区
     * @throws IOException IO异常
     */
    private void addZipEntryToArchive(String id, ZipOutputStream zos, Map<String, Integer> nameCounter, byte[] buffer) throws IOException {
        int idx = id.indexOf('!');
        String zipPath = id.substring(0, idx);
        String entryName = id.substring(idx + 1).replace('\\', '/');

        if (!viewerService.isPathAllowedForViewer(zipPath)) return;

        String baseName = entryName.contains("/") ?
                entryName.substring(entryName.lastIndexOf("/") + 1) : entryName;
        if (baseName.trim().isEmpty()) baseName = "download.log";

        String finalName = dedupeName(baseName, nameCounter);
        zos.putNextEntry(new java.util.zip.ZipEntry(finalName));

        if (zipPath.toLowerCase(Locale.ROOT).endsWith(".gz")) {
            String content = viewerService.readFileFromZip(zipPath, entryName);
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
    }

    /**
     * 将普通文件添加到归档
     *
     * @param id          文件ID
     * @param zos         ZIP输出流
     * @param nameCounter 文件名计数器
     * @param buffer      缓冲区
     * @throws IOException IO异常
     */
    private void addFileToArchive(String id, ZipOutputStream zos, Map<String, Integer> nameCounter, byte[] buffer) throws IOException {
        File file = new File(id);
        if (!viewerService.isPathAllowedForViewer(id) || !file.exists() || !file.isFile()) return;

        String finalName = dedupeName(file.getName(), nameCounter);
        zos.putNextEntry(new java.util.zip.ZipEntry(finalName));
        try (InputStream is = Files.newInputStream(file.toPath())) {
            int len;
            while ((len = is.read(buffer)) > 0) {
                zos.write(buffer, 0, len);
            }
        }
        zos.closeEntry();
    }

    /**
     * 生成去重的文件名
     *
     * @param name    基础文件名
     * @param counter 计数器
     * @return 去重后的文件名
     */
    private static String dedupeName(String name, Map<String, Integer> counter) {
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
