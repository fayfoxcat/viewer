/**
 * 工具函数模块
 */
window.LogViewerUtils = (function() {
    'use strict';

    /**
     * 判断是否为压缩文件
     */
    function isArchiveFileName(name) {
        const n = (name || "").toLowerCase();
        return n.endsWith(".zip") || n.endsWith(".jar") || n.endsWith(".gz");
    }

    /**
     * 格式化文件大小
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
     */
    function formatDateShort(ts) {
        const t = Number(ts || 0);
        if (!isFinite(t) || t <= 0) return "-";
        const d = new Date(t);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const fileDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        if (fileDate.getTime() === today.getTime()) {
            // 今天的文件只显示时间
            return d.toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit"
            });
        } else {
            // 其他日期显示月日
            return d.toLocaleDateString("zh-CN", {
                month: "2-digit",
                day: "2-digit"
            });
        }
    }

    /**
     * HTML 转义
     */
    function escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, function (m) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
        });
    }

    /**
     * 正则表达式转义
     */
    function escapeRegex(str) {
        return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * 判断元素是否接近底部
     */
    function isNearBottom($el) {
        const el = $el[0];
        if (!el) return true;
        return el.scrollHeight - $el.scrollTop() <= $el.outerHeight() + 50;
    }

    /**
     * 获取API端点路径
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
        isNearBottom,
        getEndpoint
    };
})();