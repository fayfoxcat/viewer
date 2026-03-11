/**
 * 页面缓存管理器
 */
window.LogViewerPageCache = (function() {
    'use strict';

    const CONFIG = {
        MAX_CACHE_PAGES: 10,
        PRELOAD_RANGE: 1,
        PRELOAD_DELAY: 500,
        CHECK_INTERVAL: 3000
    };

    let cache = {
        fileId: null,
        fileVersion: null,
        metadata: null,
        pages: new Map(),
        currentPage: 1,
        mode: 'auto'
    };

    let preloadTimer = null;
    let checkTimer = null;
    let abortControllers = new Map();

    function init(fileId, metadata) {
        cache.fileId = fileId;
        cache.fileVersion = metadata.fileVersion;
        cache.metadata = metadata;
        cache.pages.clear();
        cache.currentPage = 1;
        cache.mode = 'auto';
        
        startFileChangeDetection();
    }

    /**
     * 获取页面内容
     */
    async function getPage(page) {
        // 检查缓存
        if (cache.pages.has(page)) {
            const cached = cache.pages.get(page);
            if (cached.valid) {
                return cached.data;
            }
        }

        // 从服务器加载
        const data = await loadPageFromServer(page);
        
        // 存入缓存
        putCache(page, data);
        
        return data;
    }

    /**
     * 从服务器加载页面
     */
    async function loadPageFromServer(page) {
        // 取消之前的请求
        if (abortControllers.has(page)) {
            abortControllers.get(page).abort();
        }

        const controller = new AbortController();
        abortControllers.set(page, controller);

        try {
            const response = await fetch(
                `${window.LogViewerUtils.getEndpoint()}/file/content/page?` +
                `file=${encodeURIComponent(cache.fileId)}&page=${page}&pageSize=1000`,
                { signal: controller.signal }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            // 检查文件版本
            if (result.fileVersion !== cache.fileVersion) {
                handleFileChange(result.fileVersion);
            }

            abortControllers.delete(page);
            return result;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`[Cache] Load error: page ${page}`, error);
            }
            throw error;
        }
    }

    /**
     * 存入缓存
     */
    function putCache(page, data) {
        // 检查缓存大小
        if (cache.pages.size >= CONFIG.MAX_CACHE_PAGES) {
            // 移除距离当前页最远的页面
            let farthest = null;
            let maxDistance = 0;
            
            cache.pages.forEach((value, key) => {
                const distance = Math.abs(key - cache.currentPage);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    farthest = key;
                }
            });
            
            if (farthest !== null) {
                cache.pages.delete(farthest);
            }
        }

        cache.pages.set(page, {
            data: data,
            valid: true,
            loadTime: Date.now()
        });
    }

    /**
     * 设置当前页并触发预加载
     */
    function setCurrentPage(page) {
        cache.currentPage = page;
        
        // 更新模式
        updateMode();
        
        // 延迟预加载
        if (preloadTimer) {
            clearTimeout(preloadTimer);
        }
        
        preloadTimer = setTimeout(() => {
            preloadAdjacentPages(page);
        }, CONFIG.PRELOAD_DELAY);
    }

    /**
     * 预加载相邻页面
     */
    async function preloadAdjacentPages(currentPage) {
        const totalPages = cache.metadata.totalPages;
        const range = CONFIG.PRELOAD_RANGE;
        
        // 计算需要预加载的页面
        const pagesToLoad = [];
        for (let i = currentPage - range; i <= currentPage + range; i++) {
            if (i > 0 && i <= totalPages && i !== currentPage) {
                if (!cache.pages.has(i) || !cache.pages.get(i).valid) {
                    pagesToLoad.push(i);
                }
            }
        }

        // 按距离排序（优先加载距离近的）
        pagesToLoad.sort((a, b) => {
            return Math.abs(a - currentPage) - Math.abs(b - currentPage);
        });

        // 依次预加载
        for (const page of pagesToLoad) {
            try {
                await getPage(page);
            } catch (error) {
                // 忽略预加载错误
            }
        }
    }

    /**
     * 更新模式
     */
    function updateMode() {
        const totalPages = cache.metadata.totalPages;
        const currentPage = cache.currentPage;
        
        // 在最后2页时切换到实时模式
        if (currentPage >= totalPages - 1) {
            cache.mode = 'realtime';
        } else {
            cache.mode = 'history';
        }
    }

    /**
     * 启动文件变化检测
     */
    function startFileChangeDetection() {
        if (checkTimer) {
            clearInterval(checkTimer);
        }

        checkTimer = setInterval(async () => {
            try {
                await checkFileChange();
            } catch (error) {
                console.error('[Cache] File change check error:', error);
            }
        }, CONFIG.CHECK_INTERVAL);
    }

    /**
     * 停止文件变化检测
     */
    function stopFileChangeDetection() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    }

    /**
     * 检查文件变化
     */
    async function checkFileChange() {
        if (!cache.fileId || !cache.fileVersion) {
            return;
        }

        try {
            const response = await fetch(
                `${window.LogViewerUtils.getEndpoint()}/file/metadata?` +
                `file=${encodeURIComponent(cache.fileId)}`
            );

            if (!response.ok) {
                return;
            }

            const metadata = await response.json();
            
            if (metadata.fileVersion !== cache.fileVersion) {
                handleFileChange(metadata.fileVersion, metadata);
            }
            
        } catch (error) {
            console.error('[Cache] Check file change error:', error);
        }
    }

    /**
     * 处理文件变化
     */
    function handleFileChange(newVersion, newMetadata) {
        const oldVersion = cache.fileVersion;
        const oldMetadata = cache.metadata;
        
        // 判断是否为追加操作
        const isAppend = isAppendOnly(oldMetadata, newMetadata || {});
        
        if (isAppend) {
            handleAppend(newMetadata);
        } else {
            handleModification(newMetadata);
        }
    }

    /**
     * 判断是否为追加操作
     */
    function isAppendOnly(oldMeta, newMeta) {
        if (!oldMeta || !newMeta) return false;
        
        return newMeta.fileSize > oldMeta.fileSize &&
               newMeta.totalLines > oldMeta.totalLines &&
               newMeta.lastModified > oldMeta.lastModified;
    }

    /**
     * 处理追加操作
     */
    function handleAppend(newMetadata) {
        const oldTotalPages = cache.metadata.totalPages;
        const newTotalPages = newMetadata.totalPages;
        const newLines = newMetadata.totalLines - cache.metadata.totalLines;
        
        // 更新元数据
        cache.metadata = newMetadata;
        cache.fileVersion = newMetadata.fileVersion;
        
        // 清除可能受影响的页面（最后几页）
        for (let page = oldTotalPages - 1; page <= newTotalPages; page++) {
            if (cache.pages.has(page)) {
                cache.pages.get(page).valid = false;
            }
        }
        
        // 通知UI
        if (window.LogViewerApp && window.LogViewerApp.onFileAppend) {
            window.LogViewerApp.onFileAppend({
                oldTotalPages,
                newTotalPages,
                newLines
            });
        }
        
        // 如果在受影响的页面，刷新
        if (cache.currentPage >= oldTotalPages - 1) {
            if (window.LogViewerApp && window.LogViewerApp.refreshCurrentPage) {
                window.LogViewerApp.refreshCurrentPage();
            }
        }
    }

    /**
     * 处理修改操作
     */
    function handleModification(newMetadata) {
        // 清空所有缓存
        cache.pages.clear();
        
        // 更新元数据
        if (newMetadata) {
            cache.metadata = newMetadata;
            cache.fileVersion = newMetadata.fileVersion;
        }
        
        // 通知UI
        if (window.LogViewerApp && window.LogViewerApp.onFileModified) {
            window.LogViewerApp.onFileModified({
                message: '文件已被修改，正在重新加载...'
            });
        }
    }

    /**
     * 清除缓存
     */
    function clear() {
        cache.pages.clear();
        cache.fileId = null;
        cache.fileVersion = null;
        cache.metadata = null;
        cache.currentPage = 1;
        
        // 取消所有请求
        abortControllers.forEach(controller => controller.abort());
        abortControllers.clear();
        
        // 停止检测
        stopFileChangeDetection();
    }

    /**
     * 获取缓存状态
     */
    function getStatus() {
        return {
            fileId: cache.fileId,
            fileVersion: cache.fileVersion,
            currentPage: cache.currentPage,
            cachedPages: Array.from(cache.pages.keys()),
            mode: cache.mode,
            metadata: cache.metadata
        };
    }

    // 公开接口
    return {
        init,
        getPage,
        setCurrentPage,
        clear,
        getStatus,
        startFileChangeDetection,
        stopFileChangeDetection
    };
})();
