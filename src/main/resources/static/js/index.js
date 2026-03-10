/**
 * 日志查看器前端（Thymeleaf + jQuery）
 * 目标：三栏布局、树形目录/压缩包展开、多选下载、内容搜索(含正则)/高亮/方向键切换
 */

$(document).ready(function () {
    // 认证相关配置
    const authEnabled = $('body').attr('data-auth-enabled') === 'true';
    const authenticated = $('body').attr('data-authenticated') === 'true';
    
    // API 基础路径：页面本身就是在 /{endpoint} 下访问（考虑 context-path）
    const apiBase = window.location.pathname.replace(/\/$/, "");
    
    // 检查是否需要显示登录界面
    // 如果启用认证 且 未通过session认证，则显示登录页
    if (authEnabled && !authenticated) {
        $('#login-overlay').show();
        
        // 登录按钮点击事件
        $('#login-btn').click(function() {
            const authKey = $('#auth-key-input').val().trim();
            if (!authKey) {
                showLoginError('请输入认证密钥');
                return;
            }
            
            $.ajax({
                url: apiBase + '/auth/login',
                method: 'POST',
                data: { authKey: authKey },
                success: function(response) {
                    if (response.success) {
                        $('#login-overlay').hide();
                        location.reload();
                    } else {
                        showLoginError(response.message || '登录失败');
                    }
                },
                error: function() {
                    showLoginError('登录请求失败，请重试');
                }
            });
        });
        
        // 回车登录
        $('#auth-key-input').keypress(function(e) {
            if (e.which === 13) {
                $('#login-btn').click();
            }
        });
        
        function showLoginError(message) {
            $('#login-error').text(message).show();
            setTimeout(function() {
                $('#login-error').fadeOut();
            }, 3000);
        }
        
        // 如果启用了认证，阻止后续初始化
        return;
    }

    // 状态
    let currentRootPath = $("#path-select").val();
    let selectedIds = new Set(); // 下载选择集（文件/压缩包内文件）
    let activeId = null;         // 当前正在查看的文件 id（path 或 zipPath!entryName）
    let refreshTimer = null;

    let currentContentLines = [];
    let currentMatches = [];     // { lineNumber, previewHtml }
    let currentMatchIndex = -1;

    let currentPage = 1;
    let totalPages = 1;
    const LINES_PER_PAGE = 500;

    let lastAnchorIndex = -1;    // Shift 多选锚点（基于当前可见 selectable 列表）
    let expandedPaths = new Set(); // 记录已展开的目录路径（用于保持展开状态）
    let expandedZipPaths = new Set(); // 记录已展开的压缩包路径（用于保持展开状态）

    // 工具函数
    function isArchiveFileName(name) {
        const n = (name || "").toLowerCase();
        return n.endsWith(".zip") || n.endsWith(".jar") || n.endsWith(".gz");
    }

    function formatFileSize(bytes) {
        const b = Number(bytes || 0);
        if (!isFinite(b) || b <= 0) return "-";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return (b / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
    }

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

    function escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, function (m) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
        });
    }

    function escapeRegex(str) {
        return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function setEmptyHintVisible(visible) {
        if (visible) {
            $("#log-content-empty").show();
            $("#log-content-actual").hide().empty();
        } else {
            $("#log-content-empty").hide();
            $("#log-content-actual").show();
        }
    }

    function setActiveFileName(name) {
        // 更新日志文件路径显示
        const $pathValue = $("#current-file-path");
        if (name && name !== "未选择文件" && name !== null) {
            $pathValue.text(name).removeClass("placeholder");
        } else {
            $pathValue.text("请选择日志文件").addClass("placeholder");
        }
    }

    function updateDownloadButton() {
        $("#download-btn").prop("disabled", selectedIds.size === 0);
        const badge = $("#selected-count");
        if (selectedIds.size > 0) {
            badge.text(String(selectedIds.size)).show();
        } else {
            badge.hide();
        }
    }

    function buildFileRow(opts) {
        const depth = Number(opts.depth || 0);
        const expanderHtml = opts.expander
            ? `<button type="button" class="file-expander" data-expander="1">${opts.expanded ? "▾" : "▸"}</button>`
            : `<span class="file-expander hidden">▸</span>`;
        const indentStyle = depth > 0 ? `style="padding-left:${depth * 14}px"` : "";

        return `
          <div class="file-row" title="${escapeHtml(opts.tooltip || "")}">
            <div class="file-col file-col-name" ${indentStyle}>
              ${expanderHtml}
              <span class="file-icon">${opts.icon || ""}</span>
              <span class="file-label" title="${escapeHtml(opts.mtime || "-")}">${escapeHtml(opts.name)}</span>
            </div>
            <div class="file-col file-col-size" title="${escapeHtml(opts.size || "-")}">${escapeHtml(opts.size || "-")}</div>
          </div>
        `;
    }

    function getVisibleSelectableLis() {
        return $("#file-list").find("li.file-node.selectable:visible");
    }

    function setLiSelected($li, selected) {
        if (selected) $li.addClass("selected");
        else $li.removeClass("selected");
    }

    function toggleSelectionById(id) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        updateDownloadButton();
    }

    function clearAllSelection() {
        selectedIds.clear();
        $("#file-list li.file-node").removeClass("selected");
        updateDownloadButton();
    }

    function renderRootTree() {
        $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 加载中...</li>`);
        $.get(apiBase + "/files", { path: currentRootPath }, function (data) {
            $("#file-list").empty();
            renderDirectoryChildren($("#file-list"), data, 0, expandedPaths, expandedZipPaths);
        }).fail(function () {
            $("#file-list").html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function renderDirectoryChildren($ul, children, depth, expandedPathsSet, expandedZipPathsSet) {
        const list = Array.isArray(children) ? children.slice() : [];
        list.sort(function (a, b) {
            if (a.directory && !b.directory) return -1;
            if (!a.directory && b.directory) return 1;
            return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
        });

        if (list.length === 0 && $ul.is("#file-list")) {
            $ul.append(`<li class="text-center text-muted">空目录</li>`);
            return;
        }

        list.forEach(function (f) {
            const isDir = !!f.directory;
            const isArchive = !isDir && isArchiveFileName(f.name);

            const $li = $("<li class='file-node'>");
            $li.data("node", f);
            $li.attr("data-id", f.path);
            $li.attr("data-depth", String(depth));

            if (!isDir) {
                $li.addClass("selectable");
                if (selectedIds.has(f.path)) $li.addClass("selected");
            }

            let icon = "📄";
            if (isDir) icon = "📁";
            else if (isArchive) icon = "📦";

            const isExpanded = isDir 
                ? (expandedPathsSet && expandedPathsSet.has(f.path))
                : (isArchive && expandedZipPathsSet && expandedZipPathsSet.has(f.path));

            $li.html(buildFileRow({
                name: f.name,
                size: isDir ? "-" : formatFileSize(f.size),
                mtime: formatDate(f.lastModified),
                tooltip: isDir ? "目录" : ("修改时间: " + formatDate(f.lastModified)),
                depth,
                expander: isDir || isArchive,
                expanded: isExpanded,
                icon,
            }));

            if (isDir) $li.addClass("directory");
            if (isArchive) $li.addClass("zip-file");

            // 子节点容器（懒加载）
            const $childUl = $("<ul class='file-list tree-children' style='display:none;'></ul>");
            $li.append($childUl);

            // 如果之前是展开状态，立即加载并显示
            if (isExpanded && isDir && !isArchive) {
                // 目录展开：立即加载子节点
                $childUl.show();
                $li.find(".file-expander[data-expander='1']").first().text("▾");
                $.get(apiBase + "/files", { path: f.path }, function (data) {
                    $childUl.empty();
                    renderDirectoryChildren($childUl, data, depth + 1, expandedPathsSet, expandedZipPathsSet);
                    $childUl.data("loaded", true);
                }).fail(function () {
                    $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
                });
            }
            if (isArchive && expandedZipPathsSet && expandedZipPathsSet.has(f.path)) {
                // 压缩包展开：立即加载子节点
                $childUl.show();
                $li.find(".file-expander[data-expander='1']").first().text("▾");
                $.get(apiBase + "/zip/files", { zipPath: f.path, prefix: "" }, function (data) {
                    $childUl.empty();
                    renderZipChildren($childUl, f.path, "", data, depth + 1);
                    $childUl.data("loaded", true);
                }).fail(function () {
                    $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
                });
            }

            $ul.append($li);
        });
    }

    function expandDirectoryNode($li, dirPath) {
        const $childUl = $li.children("ul.tree-children");
        if ($childUl.length === 0) return;

        const alreadyLoaded = $childUl.data("loaded") === true;
        const expanded = $childUl.is(":visible");

        if (expanded) {
            $childUl.hide();
            $li.find(".file-expander[data-expander='1']").first().text("▸");
            expandedPaths.delete(dirPath);
            return;
        }

        $li.find(".file-expander[data-expander='1']").first().text("▾");
        $childUl.show();
        expandedPaths.add(dirPath);
        if (alreadyLoaded) return;

        $childUl.empty().append(`<li class="text-center"><div class="loading-spinner"></div> 加载中...</li>`);
        $.get(apiBase + "/files", { path: dirPath }, function (data) {
            $childUl.empty();
            renderDirectoryChildren($childUl, data, Number($li.attr("data-depth") || 0) + 1, expandedPaths, expandedZipPaths);
            $childUl.data("loaded", true);
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function expandArchiveNode($li, zipPath) {
        const $childUl = $li.children("ul.tree-children");
        if ($childUl.length === 0) return;

        const alreadyLoaded = $childUl.data("loaded") === true;
        const expanded = $childUl.is(":visible");

        if (expanded) {
            $childUl.hide();
            $li.find(".file-expander[data-expander='1']").first().text("▸");
            expandedZipPaths.delete(zipPath);
            return;
        }

        $li.find(".file-expander[data-expander='1']").first().text("▾");
        $childUl.show();
        expandedZipPaths.add(zipPath);
        if (alreadyLoaded) return;

        $childUl.empty().append(`<li class="text-center"><div class="loading-spinner"></div> 加载中...</li>`);
        $.get(apiBase + "/zip/files", { zipPath: zipPath, prefix: "" }, function (data) {
            $childUl.empty();
            renderZipChildren($childUl, zipPath, "", data, Number($li.attr("data-depth") || 0) + 1);
            $childUl.data("loaded", true);
            $childUl.show();
            $li.find(".file-expander[data-expander='1']").first().text("▾");
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function renderZipChildren($ul, zipPath, prefix, children, depth) {
        const list = Array.isArray(children) ? children.slice() : [];
        list.sort(function (a, b) {
            if (a.directory && !b.directory) return -1;
            if (!a.directory && b.directory) return 1;
            return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
        });

        if (list.length === 0) {
            $ul.append(`<li class="text-center text-muted">空</li>`);
            return;
        }

        list.forEach(function (f) {
            const isDir = !!f.directory;
            const entryName = (f.entryName || "").replace(/\\/g, "/");
            const id = f.path; // zipPath!entryName

            const $li = $("<li class='file-node'>");
            $li.addClass("zip-entry");
            $li.attr("data-id", id);
            $li.attr("data-zip", zipPath);
            $li.attr("data-entry", entryName);
            $li.attr("data-depth", String(depth));
            $li.data("node", f);

            if (!isDir) {
                $li.addClass("selectable");
                if (selectedIds.has(id)) $li.addClass("selected");
            }

            let icon = isDir ? "📁" : "📄";
            $li.html(buildFileRow({
                name: f.name,
                size: isDir ? "-" : formatFileSize(f.size),
                mtime: formatDate(f.lastModified),
                tooltip: isDir ? "目录" : ("修改时间: " + formatDate(f.lastModified)),
                depth,
                expander: isDir,
                expanded: false,
                icon,
            }));

            const $childUl = $("<ul class='file-list tree-children' style='display:none;'></ul>");
            $li.append($childUl);
            $ul.append($li);
        });
    }

    function expandZipDirNode($li) {
        const zipPath = $li.attr("data-zip");
        const entryPrefix = $li.attr("data-entry"); // like "a/b/"
        const $childUl = $li.children("ul.tree-children");
        if ($childUl.length === 0) return;

        const alreadyLoaded = $childUl.data("loaded") === true;
        const expanded = $childUl.is(":visible");

        if (expanded) {
            $childUl.hide();
            $li.find(".file-expander[data-expander='1']").first().text("▸");
            return;
        }

        $li.find(".file-expander[data-expander='1']").first().text("▾");
        $childUl.show();
        if (alreadyLoaded) return;

        $childUl.empty().append(`<li class="text-center"><div class="loading-spinner"></div> 加载中...</li>`);
        $.get(apiBase + "/zip/files", { zipPath: zipPath, prefix: entryPrefix }, function (data) {
            $childUl.empty();
            renderZipChildren($childUl, zipPath, entryPrefix, data, Number($li.attr("data-depth") || 0) + 1);
            $childUl.data("loaded", true);
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    // 内容：加载与渲染
    function isNearBottom($el) {
        const el = $el[0];
        if (!el) return true;
        return el.scrollHeight - $el.scrollTop() <= $el.outerHeight() + 50;
    }

    function renderLogContent(lines, highlightInfo, page) {
        const targetPage = page || currentPage;
        const startLine = (targetPage - 1) * LINES_PER_PAGE + 1;
        const endLine = Math.min(startLine + LINES_PER_PAGE - 1, lines.length);
        
        const map = highlightInfo || new Map();
        let html = `<div class="log-lines">`;
        
        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            const ln = i + 1;
            const raw = lines[i] ?? "";
            const ranges = map.get(ln) || [];
            
            let textHtml;
            if (ranges.length && window.LogHighlighter) {
                // 有搜索高亮：先应用语法高亮，再叠加搜索高亮
                textHtml = applySyntaxAndSearchHighlight(raw, ranges);
            } else if (window.LogHighlighter) {
                // 仅语法高亮
                textHtml = window.LogHighlighter.highlightLine(raw);
            } else {
                // 降级方案
                textHtml = ranges.length ? applyRangesToText(raw, ranges) : escapeHtml(raw);
            }
            
            html += `
              <div class="log-line" data-line="${ln}">
                <span class="log-ln">${ln}</span>
                <span class="log-txt">${textHtml}</span>
              </div>
            `;
        }
        html += `</div>`;
        $("#log-content-actual").html(html);
    }

    function applySyntaxAndSearchHighlight(text, searchRanges) {
        // 先应用语法高亮
        const syntaxHtml = window.LogHighlighter.highlightLine(text);
        
        // 创建临时 DOM 来处理已高亮的内容
        const $temp = $('<div>').html(syntaxHtml);
        
        // 对每个搜索匹配范围，在 DOM 中添加搜索高亮标记
        searchRanges.forEach(range => {
            highlightRangeInDom($temp[0], range.s, range.e);
        });
        
        return $temp.html();
    }

    function highlightRangeInDom(container, start, end) {
        let charCount = 0;
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const nodesToHighlight = [];
        let node;
        
        while (node = walker.nextNode()) {
            const nodeStart = charCount;
            const nodeEnd = charCount + node.textContent.length;
            
            if (nodeEnd > start && nodeStart < end) {
                const highlightStart = Math.max(0, start - nodeStart);
                const highlightEnd = Math.min(node.textContent.length, end - nodeStart);
                
                nodesToHighlight.push({
                    node: node,
                    start: highlightStart,
                    end: highlightEnd
                });
            }
            
            charCount = nodeEnd;
            if (charCount >= end) break;
        }
        
        // 从后向前处理，避免影响前面的节点
        nodesToHighlight.reverse().forEach(item => {
            const text = item.node.textContent;
            const before = text.substring(0, item.start);
            const highlight = text.substring(item.start, item.end);
            const after = text.substring(item.end);
            
            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));
            
            const mark = document.createElement('mark');
            mark.className = 'log-hit';
            mark.textContent = highlight;
            fragment.appendChild(mark);
            
            if (after) fragment.appendChild(document.createTextNode(after));
            
            item.node.parentNode.replaceChild(fragment, item.node);
        });
    }

    function updatePagination() {
        const totalLines = currentContentLines.length;
        totalPages = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));
        
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        
        $("#total-lines").text(totalLines);
        $("#page-total-count").text(totalPages);
        $("#page-jump-input").val(currentPage);
        $("#page-jump-input").attr("max", totalPages);
        
        if (totalLines > LINES_PER_PAGE) {
            $("#pagination-controls").show();
        } else {
            $("#pagination-controls").hide();
        }
        
        $("#page-first-btn, #page-prev-btn").prop("disabled", currentPage <= 1);
        $("#page-last-btn, #page-next-btn").prop("disabled", currentPage >= totalPages);
    }

    function goToPage(page) {
        const totalLines = currentContentLines.length;
        const newTotalPages = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));
        
        if (page < 1) page = 1;
        if (page > newTotalPages) page = newTotalPages;
        
        currentPage = page;
        renderLogContent(currentContentLines, null, currentPage);
        updatePagination();
    }

    function applyRangesToText(text, ranges) {
        const t = String(text ?? "");
        // ranges: [{s,e}] 0-based, e exclusive
        const sorted = ranges.slice().sort((a, b) => a.s - b.s);
        let out = "";
        let pos = 0;
        for (const r of sorted) {
            const s = Math.max(0, Math.min(t.length, r.s));
            const e = Math.max(0, Math.min(t.length, r.e));
            if (e <= s) continue;
            if (s > pos) out += escapeHtml(t.slice(pos, s));
            out += `<mark class="log-hit">${escapeHtml(t.slice(s, e))}</mark>`;
            pos = e;
        }
        if (pos < t.length) out += escapeHtml(t.slice(pos));
        return out;
    }

    function loadFsFile(filePath, keepBottom) {
        setEmptyHintVisible(false);
        $("#log-content-actual").html(`<div class="text-center p-5"><div class="loading-spinner"></div> 加载中...</div>`);
        $.get(apiBase + "/file/content", { filePath: filePath }, function (data) {
            activeId = filePath;
            setActiveFileName(filePath);
            currentContentLines = String(data || "").split("\n");
            currentPage = 1;

            const keyword = $("#content-search").val().trim();
            if (keyword) {
                runContentSearch(false);
            } else {
                currentMatches = [];
                currentMatchIndex = -1;
                renderLogContent(currentContentLines, null, currentPage);
                $("#search-results-list").empty();
            }

            updatePagination();
            if (keepBottom) scrollToBottom();
        }).fail(function () {
            $("#log-content-actual").html(`<div class="text-center text-danger p-5">加载文件失败</div>`);
        });
    }

    function loadZipEntry(zipPath, entryName, keepBottom) {
        setEmptyHintVisible(false);
        $("#log-content-actual").html(`<div class="text-center p-5"><div class="loading-spinner"></div> 加载中...</div>`);
        $.get(apiBase + "/zip/file/content", { zipPath: zipPath, entryName: entryName }, function (data) {
            activeId = zipPath + "!" + entryName;
            setActiveFileName(zipPath + "!" + entryName);
            currentContentLines = String(data || "").split("\n");
            currentPage = 1;

            const keyword = $("#content-search").val().trim();
            if (keyword) {
                runContentSearch(false);
            } else {
                currentMatches = [];
                currentMatchIndex = -1;
                renderLogContent(currentContentLines, null, currentPage);
                $("#search-results-list").empty();
            }

            updatePagination();
            if (keepBottom) scrollToBottom();
        }).fail(function () {
            $("#log-content-actual").html(`<div class="text-center text-danger p-5">加载文件失败</div>`);
        });
    }

    function scrollToLine(lineNumber) {
        const $container = $("#log-content-actual");
        const $line = $container.find(`.log-line[data-line='${lineNumber}']`).first();
        if ($line.length === 0) return;
        const containerHeight = $container.height();
        const targetOffset = containerHeight / 5;
        const top = $line.position().top + $container.scrollTop() - targetOffset;
        $container.stop(true).animate({ scrollTop: Math.max(0, top) }, 150);
    }

    function scrollToTop() {
        if (currentPage !== 1) {
            goToPage(1);
        }
        const $container = $("#log-content-actual");
        $container.stop(true).animate({ scrollTop: 0 }, 150);
    }

    function scrollToBottom() {
        if (currentPage !== totalPages) {
            goToPage(totalPages);
        }
        const $container = $("#log-content-actual");
        const el = $container[0];
        if (!el) return;
        $container.stop(true).animate({ scrollTop: el.scrollHeight }, 150);
    }

    // 内容搜索：本地搜索 + 高亮 + 右侧结果
    function runContentSearch(openPanel) {
            const keyword = $("#content-search").val().trim();
            const useRegex = $("#use-regex").is(":checked");
            if (!activeId || !keyword) {
                return;
            }

            currentMatches = [];
            currentMatchIndex = -1;
            const highlightMap = new Map();

            let regex = null;
            if (useRegex) {
                try {
                    regex = new RegExp(keyword, "gi");
                } catch (e) {
                    regex = null;
                }
            }

            // 显示搜索进度提示（大文件）
            if (currentContentLines.length > 10000) {
                $("#search-results-list").html(`<div class="text-center p-3"><div class="loading-spinner"></div> 搜索中...</div>`);
            }

            for (let i = 0; i < currentContentLines.length; i++) {
                const ln = i + 1;
                const line = String(currentContentLines[i] ?? "");
                let ranges = [];

                if (regex) {
                    regex.lastIndex = 0;
                    let m;
                    while ((m = regex.exec(line)) !== null) {
                        const s = m.index;
                        const e = m.index + String(m[0] ?? "").length;
                        if (e > s) ranges.push({ s, e });
                        if (m[0] === "") regex.lastIndex++;
                    }
                } else {
                    const low = line.toLowerCase();
                    const kw = keyword.toLowerCase();
                    let pos = 0;
                    while (true) {
                        const idx = low.indexOf(kw, pos);
                        if (idx < 0) break;
                        ranges.push({ s: idx, e: idx + kw.length });
                        pos = idx + Math.max(1, kw.length);
                    }
                }

                if (ranges.length) {
                    highlightMap.set(ln, ranges);
                    // 限制预览文本长度以提升性能
                    const maxPreviewLength = 200;
                    const preview = escapeHtml(line.length > maxPreviewLength ? line.substring(0, maxPreviewLength) + "..." : line);
                    let previewHtml;
                    if (regex) {
                        try {
                            const r = new RegExp(regex.source, "gi");
                            previewHtml = preview.replace(r, "<mark>$&</mark>");
                        } catch (e) {
                            previewHtml = preview.replace(new RegExp("(" + escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                        }
                    } else {
                        previewHtml = preview.replace(new RegExp("(" + escapeRegex(keyword) + ")", "gi"), "<mark>$1</mark>");
                    }
                    currentMatches.push({ lineNumber: ln, previewHtml: previewHtml });
                }
            }

            // 使用 setTimeout 避免阻塞 UI
            setTimeout(function() {
                renderLogContent(currentContentLines, highlightMap, currentPage);
                renderSearchResults(keyword, useRegex);
                if (openPanel !== false) openSearchPanel();
            }, 0);
        }


    function renderSearchResults(keyword, useRegex) {
        const $list = $("#search-results-list");
        $list.empty();

        if (currentMatches.length === 0) {
            $list.html(`<div class="no-results">未找到匹配结果</div>`);
            return;
        }

        const MAX_RESULTS_DISPLAY = 1000; // 限制显示数量以提升性能
        const displayCount = Math.min(currentMatches.length, MAX_RESULTS_DISPLAY);
        
        let headerText = `找到 ${currentMatches.length} 条结果`;
        if (currentMatches.length > MAX_RESULTS_DISPLAY) {
            headerText += ` (显示前 ${MAX_RESULTS_DISPLAY} 条)`;
        }
        
        $list.append(`<div class="p-2 bg-light border-bottom"><strong>${headerText}</strong></div>`);
        
        // 使用文档片段提升性能
        const fragment = document.createDocumentFragment();
        
        for (let idx = 0; idx < displayCount; idx++) {
            const m = currentMatches[idx];
            const $item = $(`<div class="search-result-item" data-idx="${idx}"></div>`);
            $item.html(`<span class="search-result-number">行 ${m.lineNumber}</span><div class="search-result-line">${m.previewHtml}</div>`);
            $item.on("click", function () {
                focusMatch(idx);
            });
            fragment.appendChild($item[0]);
        }
        
        $list.append(fragment);
    }

    function focusMatch(idx) {
        if (!currentMatches.length) return;
        const i = Math.max(0, Math.min(currentMatches.length - 1, idx));
        currentMatchIndex = i;
        const ln = currentMatches[i].lineNumber;

        // 计算目标行所在的页面
        const targetPage = Math.ceil(ln / LINES_PER_PAGE);
        
        // 如果不在当前页，先跳转到目标页
        if (targetPage !== currentPage) {
            currentPage = targetPage;
            const keyword = $("#content-search").val().trim();
            const useRegex = $("#use-regex").is(":checked");
            
            // 重新执行搜索以生成高亮
            let regex = null;
            if (useRegex) {
                try {
                    regex = new RegExp(keyword, "gi");
                } catch (e) {
                    regex = null;
                }
            }
            
            const highlightMap = new Map();
            for (let j = 0; j < currentContentLines.length; j++) {
                const lineNum = j + 1;
                const line = String(currentContentLines[j] ?? "");
                let ranges = [];

                if (regex) {
                    regex.lastIndex = 0;
                    let m;
                    while ((m = regex.exec(line)) !== null) {
                        const s = m.index;
                        const e = m.index + String(m[0] ?? "").length;
                        if (e > s) ranges.push({ s, e });
                        if (m[0] === "") regex.lastIndex++;
                    }
                } else {
                    const low = line.toLowerCase();
                    const kw = keyword.toLowerCase();
                    let pos = 0;
                    while (true) {
                        const idx = low.indexOf(kw, pos);
                        if (idx < 0) break;
                        ranges.push({ s: idx, e: idx + kw.length });
                        pos = idx + Math.max(1, kw.length);
                    }
                }

                if (ranges.length) {
                    highlightMap.set(lineNum, ranges);
                }
            }
            
            renderLogContent(currentContentLines, highlightMap, currentPage);
            updatePagination();
        }

        $("#search-results-list .search-result-item").removeClass("active");
        const $activeItem = $(`#search-results-list .search-result-item[data-idx='${i}']`).addClass("active");
        if ($activeItem.length) {
            const el = $activeItem[0];
            el.scrollIntoView({ block: "nearest" });
        }

        // 使用 setTimeout 确保 DOM 已更新
        setTimeout(function() {
            $("#log-content-actual .log-hit-current").removeClass("log-hit-current");
            const $line = $(`#log-content-actual .log-line[data-line='${ln}']`);
            $line.find("mark.log-hit").first().addClass("log-hit-current");
            scrollToLine(ln);
        }, 50);
    }

    function openSearchPanel() {
        $("#main-row").removeClass("right-collapsed");
    }

    // 左侧文件搜索
    let searchTimer = null;
    $("#file-search").on("input", function () {
        const keyword = $(this).val().trim();

        if (searchTimer) clearTimeout(searchTimer);
        if (!keyword) {
            renderRootTree();
            return;
        }
        searchTimer = setTimeout(function () {
            $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 搜索中...</li>`);
            $.get(apiBase + "/files/search", { rootPath: currentRootPath, keyword: keyword }, function (data) {
                $("#file-list").empty();
                // 搜索结果用平铺列表（不展示目录节点）
                const list = Array.isArray(data) ? data.slice() : [];
                list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
                if (!list.length) {
                    $("#file-list").append(`<li class="text-center text-muted">未找到文件</li>`);
                    return;
                }
                list.forEach(function (f) {
                    const isArchive = isArchiveFileName(f.name);
                    const $li = $("<li class='file-node selectable'>");
                    $li.attr("data-id", f.path);
                    $li.data("node", f);
                    if (selectedIds.has(f.path)) $li.addClass("selected");
                    if (isArchive) $li.addClass("zip-file");

                    $li.html(buildFileRow({
                        name: f.name,
                        size: formatFileSize(f.size),
                        mtime: formatDate(f.lastModified),
                        tooltip: "修改时间: " + formatDate(f.lastModified),
                        depth: 0,
                        expander: isArchive,
                        expanded: false,
                        icon: isArchive ? "📦" : "📄",
                    }));
                    
                    // 为压缩文件添加子节点容器
                    if (isArchive) {
                        const $childUl = $("<ul class='file-list tree-children' style='display:none;'></ul>");
                        $li.append($childUl);
                    }
                    
                    $("#file-list").append($li);
                });
            }).fail(function () {
                $("#file-list").html(`<li class="text-center text-danger">搜索失败</li>`);
            });
        }, 250);
    });

    $("#clear-search-btn").on("click", function () {
        $("#file-search").val("");
        renderRootTree();
    });

    // 左侧树：点击处理
    $(document).on("click", "#file-list .file-col-name", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!node.directory;
        const isArchive = !isDir && isArchiveFileName(node.name);
        const isZipEntry = $li.hasClass("zip-entry");

        // 目录：点击名称区域展开/折叠
        if (isDir && !isZipEntry) {
            expandDirectoryNode($li, node.path);
            return;
        }
        
        if (isZipEntry && isDir) {
            expandZipDirNode($li);
            return;
        }
        
        if (isArchive) {
            expandArchiveNode($li, node.path);
            return;
        }
        
        $li.trigger("click");
    });

    // 点击文件大小列
    $(document).on("click", "#file-list .file-col-size", function (e) {
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!node.directory;

        if (isDir) return;

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            handleSelectionClick(e, $li);
            return;
        }

        $li.trigger("click");
    });

    $(document).on("click", "#file-list .file-expander[data-expander='1']", function (e) {
        e.stopPropagation();
        const $li = $(this).closest("li.file-node");
        const node = $li.data("node");
        if (!node) return;

        const isDir = !!node.directory;
        const isArchive = !isDir && isArchiveFileName(node.name);

        if ($li.hasClass("zip-entry") && isDir) {
            expandZipDirNode($li);
            return;
        }

        if (isDir) {
            expandDirectoryNode($li, node.path);
        } else if (isArchive) {
            expandArchiveNode($li, node.path);
        }
    });

    $(document).on("click", "#file-list li.file-node", function (e) {
        const $li = $(this);
        const id = $li.attr("data-id");
        const node = $li.data("node") || {};
        const isDir = !!node.directory;
        const isArchive = !isDir && isArchiveFileName(node.name);
        const isZipEntry = $li.hasClass("zip-entry");
        const entryName = $li.attr("data-entry");
        const zipPath = $li.attr("data-zip");

        if (isDir && !isZipEntry) {
            e.stopPropagation();
            expandDirectoryNode($li, node.path);
            return;
        }
        if (isZipEntry && isDir) {
            e.stopPropagation();
            expandZipDirNode($li);
            return;
        }
        if (isArchive) {
            if (!(e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.stopPropagation();
                expandArchiveNode($li, node.path);
            } else {
                e.stopPropagation();
                handleSelectionClick(e, $li);
            }
            return;
        }

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            handleSelectionClick(e, $li);
            return;
        }

        e.stopPropagation();
        $("#file-list li.file-node").removeClass("active");
        $li.addClass("active");

        if (isZipEntry) {
            loadZipEntry(zipPath, entryName, false);
        } else {
            loadFsFile(node.path, false);
        }
    });

    function handleSelectionClick(e, $li) {
        const visible = getVisibleSelectableLis();
        const id = $li.attr("data-id");
        if (!$li.hasClass("selectable")) return;

        if (e.ctrlKey || e.metaKey) {
            toggleSelectionById(id);
            setLiSelected($li, selectedIds.has(id));
            lastAnchorIndex = visible.index($li);
            return;
        }

        if (e.shiftKey) {
            const idx = visible.index($li);
            if (lastAnchorIndex < 0) {
                toggleSelectionById(id);
                setLiSelected($li, selectedIds.has(id));
                lastAnchorIndex = idx;
                return;
            }
            const start = Math.min(lastAnchorIndex, idx);
            const end = Math.max(lastAnchorIndex, idx);
            visible.slice(start, end + 1).each(function () {
                const $n = $(this);
                const nid = $n.attr("data-id");
                selectedIds.add(nid);
                setLiSelected($n, true);
            });
            updateDownloadButton();
            return;
        }
    }

    // 下载
    $("#download-btn").on("click", function () {
        if (selectedIds.size === 0) return;
        const form = $(`<form action="${apiBase}/download" method="post"></form>`);
        Array.from(selectedIds).forEach(function (id) {
            form.append(`<input type="hidden" name="files" value="${escapeHtml(id)}"/>`);
        });
        $("body").append(form);
        form.submit();
        form.remove();
        clearAllSelection();
    });

    // 内容搜索按钮
    $("#search-btn").on("click", function () {
        if (!activeId) {
            return;
        }
        const keyword = $("#content-search").val().trim();
        if (!keyword) {
            currentMatches = [];
            currentMatchIndex = -1;
            renderLogContent(currentContentLines, null, currentPage);
            $("#search-results-list").empty();
            return;
        }
        runContentSearch(true);
        if (currentMatches.length) focusMatch(0);
    });

    // 正则表达式模式切换时，添加视觉提示
    $("#use-regex").on("change", function () {
        const $input = $("#content-search");
        if ($(this).is(":checked")) {
            $input.addClass("regex-mode");
        } else {
            $input.removeClass("regex-mode");
        }
    });

    // 方向键切换搜索结果
    $("#content-search").on("keydown", function (e) {
        if (!currentMatches.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            focusMatch((currentMatchIndex + 1) % currentMatches.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusMatch((currentMatchIndex - 1 + currentMatches.length) % currentMatches.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            $("#search-btn").trigger("click");
        }
    });

    // 顶部/底部滚动
    $("#scroll-top-btn").on("click", function () {
        if (!activeId) return;
        scrollToTop();
    });

    $("#scroll-bottom-btn").on("click", function () {
        if (!activeId) return;
        scrollToBottom();
    });

    // 分页按钮事件
    $("#page-first-btn").on("click", function () {
        if (!activeId || currentPage <= 1) return;
        goToPage(1);
    });

    $("#page-prev-btn").on("click", function () {
        if (!activeId || currentPage <= 1) return;
        goToPage(currentPage - 1);
    });

    $("#page-next-btn").on("click", function () {
        if (!activeId || currentPage >= totalPages) return;
        goToPage(currentPage + 1);
    });

    $("#page-last-btn").on("click", function () {
        if (!activeId || currentPage >= totalPages) return;
        goToPage(totalPages);
    });

    $("#page-jump-input").on("keydown", function (e) {
        if (e.key === "Enter") {
            const page = parseInt($(this).val(), 10);
            if (!isNaN(page)) {
                goToPage(page);
            }
        }
    });

    // 右侧面板关闭按钮
    $("#close-search-btn").on("click", function () {
        $("#main-row").addClass("right-collapsed");
    });

    // 实时刷新
    $("#refresh-btn").on("click", function () {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
            $(this).removeClass("btn-danger").addClass("btn-outline-secondary");
            $(this).html("<span id='refresh-icon'>🔄</span> 实时刷新");
            return;
        }

        if (!activeId) {
            return;
        }

        currentPage = totalPages;
        renderLogContent(currentContentLines, null, currentPage);
        updatePagination();
        scrollToBottom();

        $(this).removeClass("btn-outline-secondary").addClass("btn-danger");
        $(this).html("<span id='refresh-icon'>⏸</span> 停止刷新");

        refreshTimer = setInterval(function () {
            const $content = $("#log-content-actual");
            const keepBottom = isNearBottom($content);
            const wasAtBottom = keepBottom;
            const currentPageSnapshot = currentPage;

            if (!activeId) return;
            
            if (activeId.includes("!")) {
                const idx = activeId.indexOf("!");
                const zipPath = activeId.substring(0, idx);
                const entryName = activeId.substring(idx + 1);
                $.get(apiBase + "/zip/file/content", { zipPath: zipPath, entryName: entryName }, function (data) {
                    const newLines = String(data || "").split("\n");
                    const oldLineCount = currentContentLines.length;
                    currentContentLines = newLines;
                    
                    updatePagination();
                    
                    if (wasAtBottom) {
                        currentPage = totalPages;
                        renderLogContent(currentContentLines, null, currentPage);
                        scrollToBottom();
                    } else if (currentPageSnapshot !== currentPage) {
                        renderLogContent(currentContentLines, null, currentPage);
                    } else {
                        const newLineCount = currentContentLines.length;
                        if (newLineCount > oldLineCount) {
                            renderLogContent(currentContentLines, null, currentPage);
                        }
                    }
                });
            } else {
                $.get(apiBase + "/file/content", { filePath: activeId }, function (data) {
                    const newLines = String(data || "").split("\n");
                    const oldLineCount = currentContentLines.length;
                    currentContentLines = newLines;
                    
                    updatePagination();
                    
                    if (wasAtBottom) {
                        currentPage = totalPages;
                        renderLogContent(currentContentLines, null, currentPage);
                        scrollToBottom();
                    } else if (currentPageSnapshot !== currentPage) {
                        renderLogContent(currentContentLines, null, currentPage);
                    } else {
                        const newLineCount = currentContentLines.length;
                        if (newLineCount > oldLineCount) {
                            renderLogContent(currentContentLines, null, currentPage);
                        }
                    }
                });
            }
        }, 2000);
    });

    // 左侧路径选择变更
    $("#path-select").on("change", function () {
        currentRootPath = $(this).val();
        clearAllSelection();
        activeId = null;
        currentContentLines = [];
        currentMatches = [];
        currentMatchIndex = -1;
        currentPage = 1;
        totalPages = 1;
        setActiveFileName(null);
        setEmptyHintVisible(true);
        $("#file-search").val("");
        $("#pagination-controls").hide();
        renderRootTree();
    });

    // 左侧栏折叠
    $("#toggle-sidebar").on("click", function () {
        const main = $("#main-row");
        if (main.hasClass("left-collapsed")) {
            main.removeClass("left-collapsed");
            $(this).text("◀");
        } else {
            main.addClass("left-collapsed");
            $(this).text("▶");
        }
    });

    // 拖动调整宽度（更新为 CSS 变量，避免切换抖动）
    let isResizing = false;
    let currentResizable = null; // "left"
    let startX = 0;
    let startWidth = 0;

    $(".resize-handle").on("mousedown", function (e) {
        isResizing = true;
        startX = e.clientX;

        const main = document.getElementById("main-row");
        const cs = getComputedStyle(main);

        if ($(this).parent().attr("id") === "sidebar") {
            currentResizable = "left";
            startWidth = parseFloat(cs.getPropertyValue("--left-width")) || 392;
        }

        e.preventDefault();
        $("body").css("cursor", "col-resize");
    });

    $(document).on("mousemove", function (e) {
        if (!isResizing || !currentResizable) return;

        const main = document.getElementById("main-row");
        const cs = getComputedStyle(main);

        let diff = 0;
        if (currentResizable === "left") diff = e.clientX - startX;

        const newWidth = startWidth + diff;

        if (currentResizable === "left") {
            const minW = parseFloat(cs.getPropertyValue("--left-min")) || 240;
            const maxW = parseFloat(cs.getPropertyValue("--left-max")) || 640;
            const w = Math.max(minW, Math.min(maxW, newWidth));
            main.style.setProperty("--left-width", `${w}px`);
        }
    });

    $(document).on("mouseup", function () {
        if (isResizing) {
            isResizing = false;
            currentResizable = null;
            $("body").css("cursor", "default");
        }
    });

    // 初始化
    setEmptyHintVisible(true);
    updateDownloadButton();
    $("#toggle-sidebar").text($("#main-row").hasClass("left-collapsed") ? "▶" : "◀");
    renderRootTree();
});
