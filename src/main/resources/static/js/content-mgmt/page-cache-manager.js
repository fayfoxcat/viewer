/**
 * 【内容管理区】页面缓存管理器
 * 负责分页内容的缓存、预加载和文件变更检测
 */
window.ViewerPageCache = (function () {
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

    /**
     * 初始化缓存管理器
     * 设置文件信息并启动变更检测
     *
     * @param {string} fileId - 文件标识符
     * @param {Object} metadata - 文件元数据
     */
            function init(fileId, metadata) {
        cache.fileId = fileId;
        cache.fileVersion = metadata.fileVersion;
        cache.metadata = metadata;
        cache.pages.clear();
        cache.currentPage = 1;
        cache.mode = 'auto';

        if (!metadata.zipEntry && !metadata.isZipEntry) {
            startFileChangeDetection();
        }
    }

    /**
     * 获取指定页面的内容
     * 优先从缓存读取，缓存未命中则从服务器加载
     *
     * @param {number} page - 页码
     * @returns {Promise<Object>} 页面数据
     */
    async function getPage(page) {
        if (cache.pages.has(page)) {
            const cached = cache.pages.get(page);
            if (cached.valid) {
                return cached.data;
            }
        }
        const data = await loadPageFromServer(page);
        if (data === null) {
            // 请求被取消，返回 null
            return null;
        }
        putCache(page, data);
        return data;
    }

    /**
     * 从服务器加载页面内容
     * 支持请求取消和文件版本检测
     *
     * @param {number} page - 页码
     * @returns {Promise<Object>} 页面数据
     * @throws {Error} 加载失败时抛出错误
     */
        async function loadPageFromServer(page) {
        if (abortControllers.has(page)) {
            abortControllers.get(page).abort();
        }

        const controller = new AbortController();
        abortControllers.set(page, controller);

        try {
            const response = await fetch(
                `${window.ViewerUtils.getEndpoint()}/file/content/page?` +
                `file=${encodeURIComponent(cache.fileId)}&page=${page}&pageSize=1000`,
                {signal: controller.signal}
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.fileVersion !== cache.fileVersion) {
                handleFileChange(result.fileVersion);
            }

            abortControllers.delete(page);
            return result;

        } catch (error) {
            abortControllers.delete(page);
            if (error.name === 'AbortError') {
                // 请求被取消，静默处理
                return null;
            }
            console.error(`[Cache] Load error: page ${page}`, error);
            throw error;
        }
    }

    /**
     * 将页面数据放入缓存
     * 使用 LRU 策略管理缓存大小
     *
     * @param {number} page - 页码
     * @param {Object} data - 页面数据
     */
    function putCache(page, data) {
        if (cache.pages.size >= CONFIG.MAX_CACHE_PAGES) {
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
     * 设置当前页码
     * 触发预加载和模式更新
     *
     * @param {number} page - 页码
     */
    function setCurrentPage(page) {
        cache.currentPage = page;
        updateMode();

        if (preloadTimer) {
            clearTimeout(preloadTimer);
        }

        preloadTimer = setTimeout(() => {
            preloadAdjacentPages(page);
        }, CONFIG.PRELOAD_DELAY);
    }

    /**
     * 预加载相邻页面
     * 根据当前页码预加载前后若干页
     *
     * @param {number} currentPage - 当前页码
     */
    async function preloadAdjacentPages(currentPage) {
        const totalPages = cache.metadata.totalPages;
        const range = CONFIG.PRELOAD_RANGE;

        const pagesToLoad = [];
        for (let i = currentPage - range; i <= currentPage + range; i++) {
            if (i > 0 && i <= totalPages && i !== currentPage) {
                if (!cache.pages.has(i) || !cache.pages.get(i).valid) {
                    pagesToLoad.push(i);
                }
            }
        }

        pagesToLoad.sort((a, b) => {
            return Math.abs(a - currentPage) - Math.abs(b - currentPage);
        });

        for (const page of pagesToLoad) {
            try {
                await getPage(page);
            } catch (error) {
                // 忽略预加载错误
            }
        }
    }

    /**
     * 更新缓存模式
     * 根据当前页码判断是实时模式还是历史模式
     */
    function updateMode() {
        const totalPages = cache.metadata.totalPages;
        const currentPage = cache.currentPage;

        if (currentPage >= totalPages - 1) {
            cache.mode = 'realtime';
        } else {
            cache.mode = 'history';
        }
    }

    /**
     * 启动文件变更检测
     * 定时检查文件是否被修改
     */
    function startFileChangeDetection() {
        if (checkTimer) {
            clearInterval(checkTimer);
        }

        if (cache.metadata && (cache.metadata.zipEntry || cache.metadata.isZipEntry)) {
            return;
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
     * 停止文件变更检测
     * 清除定时器
     */
    function stopFileChangeDetection() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    }

    /**
     * 检查文件是否变更
     * 向服务器请求最新的文件元数据
     */
    async function checkFileChange() {
        if (!cache.fileId || !cache.fileVersion) {
            return;
        }

        try {
            const response = await fetch(
                `${window.ViewerUtils.getEndpoint()}/file/metadata?` +
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
     * 处理文件变更
     * 判断是追加还是修改，并采取相应措施
     *
     * @param {string} newVersion - 新的文件版本
     * @param {Object} [newMetadata] - 新的文件元数据
     */
    function handleFileChange(newVersion, newMetadata) {
        const oldMetadata = cache.metadata;
        const isAppend = isAppendOnly(oldMetadata, newMetadata || {});

        if (isAppend) {
            handleAppend(newMetadata);
        } else {
            handleModification(newMetadata);
        }
    }

    /**
     * 判断是否为追加操作
     * 通过比较文件大小、行数和修改时间判断
     *
     * @param {Object} oldMeta - 旧的元数据
     * @param {Object} newMeta - 新的元数据
     * @returns {boolean} 是否为追加操作
     */
    function isAppendOnly(oldMeta, newMeta) {
        if (!oldMeta || !newMeta) return false;

        return newMeta.fileSize > oldMeta.fileSize &&
            newMeta.totalLines > oldMeta.totalLines &&
            newMeta.lastModified > oldMeta.lastModified;
    }

    /**
     * 处理文件追加
     * 只失效受影响的页面缓存
     *
     * @param {Object} newMetadata - 新的文件元数据
     */
    function handleAppend(newMetadata) {
        const oldTotalPages = cache.metadata.totalPages;
        const newTotalPages = newMetadata.totalPages;
        const newLines = newMetadata.totalLines - cache.metadata.totalLines;

        cache.metadata = newMetadata;
        cache.fileVersion = newMetadata.fileVersion;

        for (let page = oldTotalPages - 1; page <= newTotalPages; page++) {
            if (cache.pages.has(page)) {
                cache.pages.get(page).valid = false;
            }
        }

        if (window.ViewerApp && window.ViewerApp.onFileAppend) {
            window.ViewerApp.onFileAppend({
                oldTotalPages,
                newTotalPages,
                newLines
            });
        }

        if (cache.currentPage >= oldTotalPages - 1) {
            if (window.ViewerApp && window.ViewerApp.refreshCurrentPage) {
                window.ViewerApp.refreshCurrentPage();
            }
        }
    }

    /**
     * 处理文件修改
     * 清空所有缓存并通知应用
     *
     * @param {Object} [newMetadata] - 新的文件元数据
     */
    function handleModification(newMetadata) {
        cache.pages.clear();

        if (newMetadata) {
            cache.metadata = newMetadata;
            cache.fileVersion = newMetadata.fileVersion;
        }

        if (window.ViewerApp && window.ViewerApp.onFileModified) {
            window.ViewerApp.onFileModified({
                message: '文件已被修改，正在重新加载...'
            });
        }
    }

    /**
     * 清空缓存
     * 重置所有状态并取消所有请求
     */
    function clear() {
        cache.pages.clear();
        cache.fileId = null;
        cache.fileVersion = null;
        cache.metadata = null;
        cache.currentPage = 1;

        abortControllers.forEach(controller => controller.abort());
        abortControllers.clear();

        stopFileChangeDetection();
    }

    /**
     * 获取缓存状态
     * 返回当前缓存的详细信息
     *
     * @returns {Object} 缓存状态对象
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

    return {
        init,
        getPage,
        setCurrentPage,
        clear,
        getStatus
    };
})();
