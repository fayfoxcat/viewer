package org.fayfoxcat.log.service;

import org.fayfoxcat.log.config.LogViewerProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpSession;
import java.util.UUID;

/**
 * 认证服务
 * 处理日志查看器的认证逻辑
 * 
 * @author fayfoxcat
 * @version 0.0.1
 */
@Service
public class AuthService {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private static final String SESSION_AUTH_KEY = "LOG_VIEWER_AUTHENTICATED";
    private static final String SESSION_KEY_VERSION = "LOG_VIEWER_KEY_VERSION";
    
    private final LogViewerProperties properties;
    private String effectiveAuthKey;
    private String keyVersion; // 密钥版本，用于检测密钥变更
    
    public AuthService(LogViewerProperties properties) {
        this.properties = properties;
    }
    
    @PostConstruct
    public void init() {
        if (properties.isEnableAuth()) {
            if (properties.getAuthKey() != null && !properties.getAuthKey().trim().isEmpty()) {
                effectiveAuthKey = properties.getAuthKey();
                keyVersion = "config:" + effectiveAuthKey.hashCode();
                logger.info("日志查看器认证已启用，使用配置的密钥");
            } else {
                effectiveAuthKey = generateTemporaryKey();
                keyVersion = "temp:" + System.currentTimeMillis();
                String separator = "================================================================================";
                logger.warn(separator);
                logger.warn("日志查看器认证已启用，但未配置密钥，已生成临时密钥：");
                logger.warn("Using generated security password: {}", effectiveAuthKey);
                logger.warn(separator);
            }
        } else {
            logger.info("日志查看器认证已禁用");
        }
    }
    
    /**
     * 生成临时密钥
     */
    private String generateTemporaryKey() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
    
    /**
     * 验证密钥
     */
    public boolean validateKey(String inputKey) {
        if (!properties.isEnableAuth()) {
            return true;
        }
        return effectiveAuthKey != null && effectiveAuthKey.equals(inputKey);
    }
    
    /**
     * 检查会话是否已认证
     * 同时检查密钥版本，如果密钥已变更（重启后生成新密钥），则使旧会话失效
     */
    public boolean isAuthenticated(HttpSession session) {
        if (!properties.isEnableAuth()) {
            return true;
        }
        Boolean authenticated = (Boolean) session.getAttribute(SESSION_AUTH_KEY);
        if (authenticated == null || !authenticated) {
            return false;
        }
        
        // 检查密钥版本，如果不匹配说明密钥已变更（如重启后生成新的临时密钥）
        String sessionKeyVersion = (String) session.getAttribute(SESSION_KEY_VERSION);
        if (sessionKeyVersion == null || !sessionKeyVersion.equals(keyVersion)) {
            // 密钥已变更，使会话失效
            session.removeAttribute(SESSION_AUTH_KEY);
            session.removeAttribute(SESSION_KEY_VERSION);
            return false;
        }
        
        return true;
    }
    
    /**
     * 设置会话认证状态
     */
    public void setAuthenticated(HttpSession session, boolean authenticated) {
        session.setAttribute(SESSION_AUTH_KEY, authenticated);
        if (authenticated) {
            // 记录当前密钥版本
            session.setAttribute(SESSION_KEY_VERSION, keyVersion);
        } else {
            session.removeAttribute(SESSION_KEY_VERSION);
        }
    }
    

    
    /**
     * 是否启用认证
     */
    public boolean isAuthEnabled() {
        return properties.isEnableAuth();
    }
}
