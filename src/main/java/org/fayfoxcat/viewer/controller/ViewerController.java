package org.fayfoxcat.viewer.controller;

import org.fayfoxcat.viewer.config.ViewerProperties;
import org.fayfoxcat.viewer.entity.FileMetadata;
import org.fayfoxcat.viewer.entity.PageContent;
import org.fayfoxcat.viewer.entity.SearchRequest;
import org.fayfoxcat.viewer.entity.SearchResult;
import org.fayfoxcat.viewer.service.AuthService;
import org.fayfoxcat.viewer.service.DownloadService;
import org.fayfoxcat.viewer.service.ViewerService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("${viewer.viewer.endpoint:/viewer}")
public class ViewerController {

    private final ViewerProperties properties;
    private final ViewerService viewerService;
    private final AuthService authService;
    private final DownloadService downloadService;

    public ViewerController(ViewerProperties properties, ViewerService viewerService, AuthService authService, DownloadService downloadService) {
        this.properties = properties;
        this.viewerService = viewerService;
        this.authService = authService;
        this.downloadService = downloadService;
    }

        /**
     * 首页
     *
     * @param model   模型
     * @param session HTTP会话
     * @return 文件查看器页面
     */
    @GetMapping
    public String index(Model model, HttpSession session) {
        model.addAttribute("paths", properties.getEffectivePaths());
        model.addAttribute("endpoint", properties.getEndpoint());
        model.addAttribute("authEnabled", authService.isAuthEnabled());
        model.addAttribute("authenticated", authService.isAuthenticated(session));
        return "index";
    }

    /**
     * 登录验证
     *
     * @param authKey 认证密钥
     * @param session HTTP会话
     * @return 验证结果
     */
    @PostMapping("/auth/login")
    @ResponseBody
    public Map<String, Object> login(@RequestParam String authKey, HttpSession session) {
        Map<String, Object> result = new HashMap<>();
        if (authService.validateKey(authKey)) {
            authService.setAuthenticated(session, true);
            result.put("success", true);
            result.put("message", "认证成功");
        } else {
            result.put("success", false);
            result.put("message", "密钥错误");
        }
        return result;
    }

    /**
     * 登出
     *
     * @param session HTTP会话
     * @return 登出结果
     */
    @PostMapping("/auth/logout")
    @ResponseBody
    public Map<String, Object> logout(HttpSession session) {
        authService.setAuthenticated(session, false);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "已登出");
        return result;
    }

    /**
     * 检查认证状态
     *
     * @param session HTTP会话
     * @return 认证状态
     */
    @GetMapping("/auth/check")
    @ResponseBody
    public Map<String, Object> checkAuth(HttpSession session) {
        Map<String, Object> result = new HashMap<>();
        result.put("authenticated", authService.isAuthenticated(session));
        result.put("authEnabled", authService.isAuthEnabled());
        return result;
    }

    /**
     * 列出指定路径下的文件
     *
     * @param path 路径
     * @return 文件列表
     */
        @GetMapping("/files")
    @ResponseBody
    public List<ViewerService.FileInfo> listFiles(@RequestParam String path) {
        return viewerService.listFiles(path);
    }

    /**
     * 在指定根路径下递归搜索文件名
     *
     * @param rootPath 根路径
     * @param keyword  关键字
     * @return 匹配到的文件列表
     */
        @GetMapping("/files/search")
    @ResponseBody
    public List<ViewerService.FileInfo> searchFiles(@RequestParam String rootPath, @RequestParam String keyword) {
        return viewerService.searchFiles(rootPath, keyword);
    }

    /**
     * 列出压缩文件中的文件
     *
     * @param zipPath 压缩文件路径
     * @param prefix  前缀过滤
     * @return 压缩文件中的文件列表
     * @throws IOException IO异常
     */
        @GetMapping("/zip/files")
    @ResponseBody
    public List<ViewerService.FileInfo> listFilesInZip(@RequestParam String zipPath,
                                                          @RequestParam(required = false, defaultValue = "") String prefix) throws IOException {
        return viewerService.listFilesInZip(zipPath, prefix);
    }

    /**
     * 获取文件内容
     *
     * @param filePath 文件路径
     * @return 文件内容
     * @throws IOException IO异常
     */
    @GetMapping("/file/content")
    @ResponseBody
    public String getFileContent(@RequestParam String filePath) throws IOException {
        return viewerService.readFileContent(filePath);
    }

    /**
     * 获取压缩文件中的文件内容
     *
     * @param zipPath   压缩文件路径
     * @param entryName 压缩文件中的文件名称
     * @return 文件内容
     * @throws IOException IO异常
     */
    @GetMapping("/zip/file/content")
    @ResponseBody
    public String getFileFromZip(@RequestParam String zipPath, @RequestParam String entryName) throws IOException {
        return viewerService.readFileFromZip(zipPath, entryName);
    }

    /**
     * 搜索文件内容
     *
     * @param filePath 文件路径
     * @param keyword  搜索关键词
     * @param useRegex 是否使用正则表达式
     * @return 搜索结果
     * @throws IOException IO异常
     */
    @PostMapping("/file/search")
    @ResponseBody
    public List<String> searchFileContent(@RequestParam String filePath,
                                          @RequestParam String keyword,
                                          @RequestParam(defaultValue = "false") boolean useRegex) throws IOException {
        return viewerService.searchFileContent(filePath, keyword, useRegex);
    }

    /**
     * 获取文件元数据（分页模式）
     *
     * @param file 文件路径
     * @return 文件元数据
     * @throws IOException IO异常
     */
    @GetMapping("/file/metadata")
    @ResponseBody
    public FileMetadata getFileMetadata(@RequestParam("file") String file) throws IOException {
        return viewerService.getFileMetadata(file);
    }

    /**
     * 分页获取文件内容
     *
     * @param file     文件路径
     * @param page     页码（从1开始）
     * @param pageSize 每页行数
     * @return 分页内容
     * @throws IOException IO异常
     */
    @GetMapping("/file/content/page")
    @ResponseBody
    public PageContent getFileContentByPage(@RequestParam("file") String file,
                                            @RequestParam(defaultValue = "1") int page,
                                            @RequestParam(defaultValue = "1000") int pageSize) throws IOException {
        return viewerService.readFileContentByPage(file, page, pageSize);
    }

    /**
     * 服务端搜索文件内容（增强版）
     *
     * @param request 搜索请求参数
     * @return 搜索结果
     * @throws IOException IO异常
     */
    @PostMapping("/file/search/advanced")
    @ResponseBody
    public SearchResult searchFileContentAdvanced(@RequestBody SearchRequest request) throws IOException {
        return viewerService.searchFileContentAdvanced(request);
    }

    /**
     * 获取正则表达式配置
     *
     * @return 正则表达式配置
     */
    @GetMapping("/patterns")
    @ResponseBody
    public Map<String, Object> getLogPatterns() {
        return viewerService.getLogPatterns();
    }

    /**
     * 下载文件
     *
     * @param files    文件路径列表
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
            return downloadService.downloadSingleFile(files.get(0), response);
        }
        return downloadService.downloadMultipleFiles(files, response);
    }
}
