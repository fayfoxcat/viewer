package org.fayfoxcat.viewer.service;

import org.fayfoxcat.viewer.config.ViewerProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpSession;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 认证服务
 * 处理文件查看器的认证逻辑，包括密钥验证和会话管理
 *
 * @author fayfoxcat
 * @version 0.0.1
 */
@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private static final String SESSION_AUTH_KEY = "viewer_AUTHENTICATED";
    private static final String SESSION_KEY_VERSION = "viewer_KEY_VERSION";
    private static final String SESSION_AUTH_TIME = "viewer_AUTH_TIME";

    // 会话超时时间（毫秒）- 24小时
    private static final long SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000L;

        private final ViewerProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    private String effectiveAuthKey;
    private String keyVersion;
    private long keyGeneratedTime;

    public AuthService(ViewerProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        if (properties.isEnableAuth()) {
            if (properties.getSecretKey() != null && !properties.getSecretKey().trim().isEmpty()) {
                effectiveAuthKey = properties.getSecretKey().trim();
                keyVersion = "config:" + effectiveAuthKey.hashCode();
                keyGeneratedTime = System.currentTimeMillis();
                logger.info("Viewer文件查看器认证已启用，使用配置的密钥");
            } else {
                effectiveAuthKey = generateSecureTemporaryKey();
                keyVersion = "temp:" + keyGeneratedTime;
                                logger.warn("Viewer文件查看器认证已启用，但未配置密钥，已生成临时密钥：{}", effectiveAuthKey);
                logger.warn("建议在配置文件中设置 viewer.viewer.secret-key 以使用固定密钥");
            }
        } else {
            logger.info("Viewer文件查看器认证已禁用");
        }
    }

    /**
     * 生成安全的临时密钥
     * 使用 SecureRandom 生成高熵密钥
     */
    private String generateSecureTemporaryKey() {
        keyGeneratedTime = System.currentTimeMillis();
        byte[] keyBytes = new byte[16];
        secureRandom.nextBytes(keyBytes);

        StringBuilder sb = new StringBuilder();
        for (byte b : keyBytes) {
            sb.append(String.format("%02x", b & 0xff));
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMddHHmm"));
        return sb.substring(0, 24) + timestamp;
    }

    /**
     * 验证密钥
     *
     * @param inputKey 用户输入的密钥
     * @return 验证结果
     */
    public boolean validateKey(String inputKey) {
        if (!properties.isEnableAuth()) {
            return true;
        }

        if (inputKey == null || inputKey.trim().isEmpty()) {
            logger.debug("密钥验证失败：输入为空");
            return false;
        }

        boolean isValid = effectiveAuthKey != null && effectiveAuthKey.equals(inputKey.trim());

        if (!isValid) {
            logger.warn("密钥验证失败：输入密钥不匹配，来源IP可能需要关注");
        } else {
            logger.debug("密钥验证成功");
        }

        return isValid;
    }

    /**
     * 检查会话是否已认证
     * 验证认证状态、密钥版本和会话超时
     *
     * @param session HTTP会话
     * @return 是否已认证
     */
    public boolean isAuthenticated(HttpSession session) {
        if (!properties.isEnableAuth()) {
            return true;
        }

        Boolean authenticated = (Boolean) session.getAttribute(SESSION_AUTH_KEY);
        if (authenticated == null || !authenticated) {
            return false;
        }

        // 检查密钥版本，防止密钥变更后的会话重用
        String sessionKeyVersion = (String) session.getAttribute(SESSION_KEY_VERSION);
        if (sessionKeyVersion == null || !sessionKeyVersion.equals(keyVersion)) {
            logger.debug("会话失效：密钥版本不匹配");
            clearAuthentication(session);
            return false;
        }

        // 检查会话超时
        Long authTime = (Long) session.getAttribute(SESSION_AUTH_TIME);
        if (authTime == null || (System.currentTimeMillis() - authTime) > SESSION_TIMEOUT_MS) {
            logger.debug("会话失效：已超时");
            clearAuthentication(session);
            return false;
        }

        return true;
    }

    /**
     * 设置会话认证状态
     *
     * @param session       HTTP会话
     * @param authenticated 认证状态
     */
    public void setAuthenticated(HttpSession session, boolean authenticated) {
        if (authenticated) {
            session.setAttribute(SESSION_AUTH_KEY, true);
            session.setAttribute(SESSION_KEY_VERSION, keyVersion);
            session.setAttribute(SESSION_AUTH_TIME, System.currentTimeMillis());
            logger.debug("会话认证成功，会话ID: {}", session.getId());
        } else {
            clearAuthentication(session);
            logger.debug("会话认证已清除，会话ID: {}", session.getId());
        }
    }

    /**
     * 清除会话认证信息
     *
     * @param session HTTP会话
     */
    private void clearAuthentication(HttpSession session) {
        session.removeAttribute(SESSION_AUTH_KEY);
        session.removeAttribute(SESSION_KEY_VERSION);
        session.removeAttribute(SESSION_AUTH_TIME);
    }

    /**
     * 是否启用认证
     *
     * @return 认证启用状态
     */
    public boolean isAuthEnabled() {
        return properties.isEnableAuth();
    }

    /**
     * 获取密钥生成时间（用于监控）
     *
     * @return 密钥生成时间戳
     */
    public long getKeyGeneratedTime() {
        return keyGeneratedTime;
    }
}
