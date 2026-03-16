/**
 * 工具函数模块
 * 提供通用的工具函数，如格式化、转义等
 */
window.LogViewerUtils = (function () {
    'use strict';

    /**
     * 判断是否为压缩文件
     * 支持 .zip, .jar, .gz 格式
     *
     * @param {string} name - 文件名
     * @returns {boolean} 是否为压缩文件
     */
    function isArchiveFileName(name) {
        const n = (name || "").toLowerCase();
        return n.endsWith(".zip") || n.endsWith(".jar") || n.endsWith(".gz");
    }

    /**
     * 格式化文件大小
     * 自动选择合适的单位（B, KB, MB, GB, TB）
     *
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的文件大小字符串
     */
    function formatFileSize(bytes) {
        const b = Number(bytes || 0);
        if (!isFinite(b) || b <= 0) return "-";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return (b / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
    }

    /**
     * 格式化日期时间
     * 返回完整的日期时间字符串
     *
     * @param {number} ts - 时间戳（毫秒）
     * @returns {string} 格式化后的日期时间字符串
     */
    function formatDate(ts) {
        const t = Number(ts || 0);
        if (!isFinite(t) || t <= 0) return "-";
        const d = new Date(t);
        return d.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    /**
     * 格式化短日期时间（用于文件列表）
     * 显示年月日和时分
     *
     * @param {number} ts - 时间戳（毫秒）
     * @returns {string} 格式化后的短日期时间字符串
     */
    function formatDateShort(ts) {
        const t = Number(ts || 0);
        if (!isFinite(t) || t <= 0) return "-";
        const d = new Date(t);

        return d.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    /**
     * HTML 转义
     * 防止 XSS 攻击，转义特殊字符
     *
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的 HTML 安全文本
     */
    function escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, function (m) {
            return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[m];
        });
    }

    /**
     * 正则表达式转义
     * 转义正则表达式中的特殊字符
     *
     * @param {string} str - 需要转义的字符串
     * @returns {string} 转义后的正则表达式安全字符串
     */
    function escapeRegex(str) {
        return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * 判断元素是否接近底部
     * 用于判断是否需要自动滚动
     *
     * @param {jQuery} $el - jQuery 元素对象
     * @returns {boolean} 是否接近底部（距离底部小于50px）
     */
    function isNearBottom($el) {
        const el = $el[0];
        if (!el) return true;
        return el.scrollHeight - $el.scrollTop() <= $el.outerHeight() + 50;
    }

    /**
     * 获取 API 端点路径
     * 从当前 URL 中提取端点路径
     *
     * @returns {string} API 端点路径
     */
    function getEndpoint() {
        return window.location.pathname.replace(/\/$/, "");
    }

    // 公开接口
    return {
        isArchiveFileName,
        formatFileSize,
        formatDate,
        formatDateShort,
        escapeHtml,
        escapeRegex,
        getEndpoint
    };
})();
