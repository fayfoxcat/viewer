/**
 * 【目录区】文件树渲染模块
 */
window.LogViewerFileTree = (function () {
    'use strict';

    let apiBase = '';
    let expandedPaths = new Set();
    let expandedZipPaths = new Set();
    let currentSortBy = 'name';
    let currentSortOrder = 'asc';

    function buildFileRow(opts) {
        const depth = Number(opts.depth || 0);
        const expanderHtml = opts.expander
            ? `<button type="button" class="file-expander" data-expander="1">${opts.expanded ? "▾" : "▸"}</button>`
            : `<span class="file-expander hidden">▸</span>`;
        const indentStyle = depth > 0 ? `style="padding-left:${depth * 14}px"` : "";

        return `
          <div class="file-row" title="${window.LogViewerUtils.escapeHtml(opts.tooltip || "")}">
            <div class="file-col file-col-name" ${indentStyle}>
              ${expanderHtml}
              <span class="file-icon">${opts.icon || ""}</span>
              <span class="file-label" title="${window.LogViewerUtils.escapeHtml(opts.name || "")}">${window.LogViewerUtils.escapeHtml(opts.name)}</span>
            </div>
            <div class="file-col file-col-time" title="${window.LogViewerUtils.escapeHtml(opts.mtime || "-")}">${window.LogViewerUtils.escapeHtml(opts.mtimeShort || "-")}</div>
            <div class="file-col file-col-size" title="${window.LogViewerUtils.escapeHtml(opts.size || "-")}">${window.LogViewerUtils.escapeHtml(opts.size || "-")}</div>
          </div>
        `;
    }

    function sortFileList(list, sortBy, sortOrder) {
        return list.slice().sort(function (a, b) {
            if (a.directory && !b.directory) return -1;
            if (!a.directory && b.directory) return 1;

            let result = 0;
            if (sortBy === 'name') {
                result = String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
            } else if (sortBy === 'size') {
                const sizeA = a.directory ? 0 : (a.size || 0);
                const sizeB = b.directory ? 0 : (b.size || 0);
                result = sizeA - sizeB;
            } else if (sortBy === 'time') {
                const timeA = a.lastModified || 0;
                const timeB = b.lastModified || 0;
                result = timeA - timeB;
            }

            return sortOrder === 'desc' ? -result : result;
        });
    }

    function renderRootTree(rootPath) {
        $("#file-list").empty().append(`<li class="text-center"><div class="loading-spinner"></div> 加载中...</li>`);
        $.get(apiBase + "/files", {path: rootPath}, function (data) {
            $("#file-list").empty();
            renderDirectoryChildren($("#file-list"), data, 0, expandedPaths, expandedZipPaths);
        }).fail(function () {
            $("#file-list").html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function renderDirectoryChildren($ul, children, depth, expandedPathsSet, expandedZipPathsSet) {
        const list = Array.isArray(children) ? children.slice() : [];
        const sortedList = sortFileList(list, currentSortBy, currentSortOrder);

        if (sortedList.length === 0 && $ul.is("#file-list")) {
            $ul.append(`<li class="text-center text-muted">空目录</li>`);
            return;
        }

        sortedList.forEach(function (f) {
            const isDir = !!f.directory;
            const isArchive = !isDir && window.LogViewerUtils.isArchiveFileName(f.name);

            const $li = $("<li class='file-node'>");
            $li.data("node", f);
            $li.attr("data-id", f.path);
            $li.attr("data-depth", String(depth));

            if (!isDir) {
                $li.addClass("selectable");
                const currentSelectedIds = window.LogViewerSelectionManager ? window.LogViewerSelectionManager.getSelectedIds() : new Set();
                if (currentSelectedIds.has(f.path)) $li.addClass("selected");
            }

            let icon = "📄";
            if (isDir) icon = "📁";
            else if (isArchive) icon = "📦";

            const isExpanded = isDir
                ? (expandedPathsSet && expandedPathsSet.has(f.path))
                : (isArchive && expandedZipPathsSet && expandedZipPathsSet.has(f.path));

            $li.html(buildFileRow({
                name: f.name,
                size: isDir ? "-" : window.LogViewerUtils.formatFileSize(f.size),
                mtime: window.LogViewerUtils.formatDate(f.lastModified),
                mtimeShort: window.LogViewerUtils.formatDateShort(f.lastModified),
                tooltip: f.name,
                depth,
                expander: isDir || isArchive,
                expanded: isExpanded,
                icon,
            }));

            if (isDir) $li.addClass("directory");
            if (isArchive) $li.addClass("zip-file");

            const $childUl = $("<ul class='file-list tree-children' style='display:none;'></ul>");
            $li.append($childUl);

            if (isExpanded && isDir && !isArchive) {
                loadDirectoryChildren($li, f.path, $childUl, depth, expandedPathsSet, expandedZipPathsSet);
            }
            if (isArchive && expandedZipPathsSet && expandedZipPathsSet.has(f.path)) {
                loadArchiveChildren($li, f.path, $childUl, depth);
            }

            $ul.append($li);
        });
    }

    function loadDirectoryChildren($li, dirPath, $childUl, depth, expandedPathsSet, expandedZipPathsSet) {
        $childUl.show();
        $li.find(".file-expander[data-expander='1']").first().text("▾");
        $.get(apiBase + "/files", {path: dirPath}, function (data) {
            $childUl.empty();
            renderDirectoryChildren($childUl, data, depth + 1, expandedPathsSet, expandedZipPathsSet);
            $childUl.data("loaded", true);
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function loadArchiveChildren($li, zipPath, $childUl, depth) {
        $childUl.show();
        $li.find(".file-expander[data-expander='1']").first().text("▾");
        $.get(apiBase + "/zip/files", {zipPath: zipPath, prefix: ""}, function (data) {
            $childUl.empty();
            renderZipChildren($childUl, zipPath, "", data, depth + 1);
            $childUl.data("loaded", true);
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
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
        $.get(apiBase + "/files", {path: dirPath}, function (data) {
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
        $.get(apiBase + "/zip/files", {zipPath: zipPath, prefix: ""}, function (data) {
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
        const sortedList = sortFileList(list, currentSortBy, currentSortOrder);

        if (sortedList.length === 0) {
            $ul.append(`<li class="text-center text-muted">空</li>`);
            return;
        }

        sortedList.forEach(function (f) {
            const isDir = !!f.directory;
            const entryName = (f.entryName || "").replace(/\\/g, "/");
            const id = f.path;

            const $li = $("<li class='file-node'>");
            $li.addClass("zip-entry");
            $li.attr("data-id", id);
            $li.attr("data-zip", zipPath);
            $li.attr("data-entry", entryName);
            $li.attr("data-depth", String(depth));
            $li.data("node", f);

            if (!isDir) {
                $li.addClass("selectable");
                const currentSelectedIds = window.LogViewerSelectionManager ? window.LogViewerSelectionManager.getSelectedIds() : new Set();
                if (currentSelectedIds.has(id)) $li.addClass("selected");
            }

            let icon = isDir ? "📁" : "📄";
            $li.html(buildFileRow({
                name: f.name,
                size: isDir ? "-" : window.LogViewerUtils.formatFileSize(f.size),
                mtime: window.LogViewerUtils.formatDate(f.lastModified),
                mtimeShort: window.LogViewerUtils.formatDateShort(f.lastModified),
                tooltip: f.name,
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
        const entryPrefix = $li.attr("data-entry");
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
        $.get(apiBase + "/zip/files", {zipPath: zipPath, prefix: entryPrefix}, function (data) {
            $childUl.empty();
            renderZipChildren($childUl, zipPath, entryPrefix, data, Number($li.attr("data-depth") || 0) + 1);
            $childUl.data("loaded", true);
        }).fail(function () {
            $childUl.html(`<li class="text-center text-danger">加载失败</li>`);
        });
    }

    function setSortBy(sortBy, sortOrder) {
        currentSortBy = sortBy;
        currentSortOrder = sortOrder;
        $('.sort-btn').removeClass('active');
        $(`.sort-btn[data-sort="${sortBy}"][data-order="${sortOrder}"]`).addClass('active');
    }

    function init(apiBasePath) {
        apiBase = apiBasePath;
    }

    function clearExpandedState() {
        expandedPaths.clear();
        expandedZipPaths.clear();
    }

    return {
        init,
        renderRootTree,
        expandDirectoryNode,
        expandArchiveNode,
        expandZipDirNode,
        clearExpandedState,
        setSortBy
    };
})();
