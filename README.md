# Viewer - 文件查看器

[![Release Build](https://github.com/fayfoxcat/viewer/workflows/Release%20Build/badge.svg)](https://github.com/fayfoxcat/viewer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Java Version](https://img.shields.io/badge/Java-8%2B-blue.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.18-brightgreen.svg)](https://spring.io/projects/spring-boot)

一个现代化的在线文件查看组件，基于 Spring Boot 构建，提供强大的文件浏览、搜索和管理功能。支持多种压缩格式、智能语法高亮、正则表达式搜索，以及灵活的认证机制。

## ✨ 核心特性

### 📁 文件管理
- **多目录支持**: 配置多个文件目录，统一管理
- **文件树浏览**: 直观的树形结构，支持展开/折叠
- **压缩包支持**: 原生支持 `.zip`、`.jar`、`.gz` 格式
- **批量操作**: 多选下载，Ctrl/Shift 快捷选择

### 🔍 搜索功能
- **文件名搜索**: 快速定位目标文件
- **内容搜索**: 支持关键字和正则表达式
- **实时高亮**: 搜索结果实时高亮显示
- **导航跳转**: 方向键快速切换搜索结果

### 🎨 用户体验
- **现代化UI**: 基于 Ant Design 设计语言
- **响应式布局**: 完美适配桌面和移动设备
- **语法高亮**: 智能识别日志级别并高亮
- **实时刷新**: 自动监控文件变化
- **分页浏览**: 大文件智能分页，性能优化

### 🔐 安全认证
- **灵活认证**: 支持禁用/密钥认证模式
- **会话管理**: 安全的会话超时机制
- **路径白名单**: 严格的文件访问权限控制
- **安全日志**: 详细的访问和认证日志

## 🚀 快速开始

### 1. 添加依赖

```xml
<dependency>
    <groupId>org.fayfoxcat</groupId>
    <artifactId>viewer</artifactId>
    <version>0.0.1</version>
</dependency>
```

### 2. 基础配置

**最简配置（开发环境）**：
```yaml
viewer:
  viewer:
    enable-auth: false  # 禁用认证
    paths:
      - ./files         # 项目文件目录
      - /var/data/app   # 系统数据目录
```

**生产环境配置**：
```yaml
viewer:
  config:
    enable-auth: true
    secret-key: "your-secure-password-here"
    endpoint: /admin/viewer
    paths:
      - /var/data/application
      - /opt/app/files
```

### 3. 启动访问

启动应用后访问：`http://localhost:1098/viewer`

## 📦 部署场景

### 场景1：作为依赖集成到现有项目

适用于已有 Spring Boot 项目，需要添加文件查看功能。

1. 添加 Maven 依赖（见上方）
2. 在 `application.yml` 中配置
3. 启动项目，访问配置的端点

### 场景2：独立运行

适用于需要独立部署的文件查看服务。

```bash
# 下载可执行 JAR
wget https://github.com/fayfoxcat/viewer/releases/download/v0.0.1/viewer-0.0.1-exec.jar

# 创建配置文件
cat > application.yml << EOF
viewer:
  config:
    enable-auth: true
    secret-key: "MySecurePassword123"
    paths:
      - /var/data
      - /opt/app/files
EOF

# 启动服务
java -jar viewer-0.0.1-exec.jar
```

## 📖 详细配置

### 核心配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `viewer.viewer.endpoint` | String | `/viewer` | 访问端点路径 |
| `viewer.viewer.enable-auth` | Boolean | `true` | 是否启用认证保护 |
| `viewer.viewer.secret-key` | String | `null` | 认证密钥（留空自动生成） |
| `viewer.viewer.paths` | List | `[]` | 允许访问的目录白名单 |

### 内容高亮配置

系统支持通过 `patterns.yml` 配置文件自定义内容高亮规则：

```yaml
viewer:
  patterns:
    rules:
      error:
        name: 错误级别
        regex: "\\b(ERROR|FATAL|SEVERE)\\b"
        class-name: viewer-error
        color: "#f44336"
        description: 匹配错误级别标识
        highlight: true
    presets:
      java-exception:
        name: Java异常堆栈
        patterns:
          - error
          - exception
          - date
        description: Java异常内容组合
```

内置高亮规则包括：
- 日期时间格式
- 日志级别标识（ERROR、WARN、INFO、DEBUG）
- 异常类名
- IP地址、URL、邮箱
- 字符串、数字、UUID
- SQL关键字

### 认证配置详解

#### 🔓 开发模式（禁用认证）
```yaml
viewer:
  viewer:
    enable-auth: false
```
> ⚠️ **安全提醒**: 仅适用于开发环境或内网环境

#### 🔐 密钥认证模式

**固定密钥**（推荐生产环境）：
```yaml
viewer:
  viewer:
    enable-auth: true
    secret-key: "MySecurePassword123!"
```

**临时密钥**（快速测试）：
```yaml
viewer:
  viewer:
    enable-auth: true
    # 不配置 secret-key，系统自动生成并输出到控制台
```

### 路径配置示例

```yaml
viewer:
  config:
    paths:
      # 绝对路径
      - /var/data/application
      - C:\data\app
      
      # 相对路径
      - ./files
      - ../shared-data
      
      # 网络路径（Windows）
      - \\server\share\files
      
      # 多环境配置
      - ${DATA_DIR:/opt/app/files}  # 环境变量，默认值
```

## 🔧 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/fayfoxcat/viewer.git
cd viewer

# 启动开发服务器
mvn spring-boot:run

# 访问应用
open http://localhost:1098/viewer
```

### 构建部署

```bash
# 编译打包
mvn clean package

# 生成文件
# target/viewer-0.0.1.jar        - 库文件（集成使用）
# target/viewer-0.0.1-exec.jar   - 可执行文件（独立运行）

# 独立运行
java -jar target/viewer-0.0.1-exec.jar
```

## 📊 技术架构

### 项目结构

```
viewer/
├── src/main/java/org/fayfoxcat/viewer/
│   ├── config/                          # 配置层
│   │   ├── AuthInterceptor.java         # 认证拦截器
│   │   ├── FilePatternsProperties.java  # 文件高亮规则配置
│   │   ├── ViewerAutoConfiguration.java  # 自动配置类
│   │   ├── ViewerProperties.java      # 核心配置属性
│   │   ├── ViewerSecurityConfig.java  # 安全配置
│   │   ├── ViewerUniversalFilter.java # 通用过滤器
│   │   └── WebConfig.java               # Web配置
│   ├── controller/                      # 控制层
│   │   └── ViewerController.java      # 主控制器（REST API）
│   ├── service/                         # 服务层
│   │   ├── AuthService.java             # 认证服务
│   │   ├── DownloadService.java         # 文件下载服务
│   │   ├── FileIndexCache.java          # 文件索引缓存
│   │   └── ViewerService.java         # 核心业务逻辑
│   └── ViewerApplication.java         # 应用入口
├── src/main/resources/
│   ├── static/                          # 前端静态资源
│   │   ├── css/                         # 样式文件
│   │   │   ├── common.css               # 通用样式
│   │   │   ├── content-mgmt.css         # 内容管理样式
│   │   │   ├── directory.css            # 目录树样式
│   │   │   ├── content-area.css         # 内容显示区样式
│   │   │   ├── login.css                # 登录页样式
│   │   │   ├── notification.css         # 通知组件样式
│   │   │   ├── search-panel.css         # 搜索面板样式
│   │   │   └── utilities.css            # 工具类样式
│   │   └── js/                          # JavaScript模块
│   │       ├── common/                  # 通用模块
│   │       │   ├── auth.js              # 认证管理
│   │       │   ├── notification.js      # 通知系统
│   │       │   ├── ui-state.js          # UI状态管理
│   │       │   └── utils.js             # 工具函数
│   │       ├── content-mgmt/            # 内容管理模块
│   │       │   ├── page-cache-manager.js # 页面缓存
│   │       │   ├── pagination.js        # 分页控制
│   │       │   └── toolbar.js           # 工具栏
│   │       ├── directory/               # 目录管理模块
│   │       │   ├── file-operations.js   # 文件操作
│   │       │   ├── file-tree.js         # 文件树组件
│   │       │   └── selection-manager.js # 选择管理
│   │       ├── content-area/            # 内容显示模块
│   │       │   ├── content-renderer.js  # 内容渲染
│   │       │   └── context-highlighter.js   # 语法高亮
│   │       ├── search-results/          # 搜索模块
│   │       │   └── search.js            # 搜索功能
│   │       └── app.js                   # 应用主入口
│   ├── templates/
│   │   └── index.html                   # 主页面模板
│   ├── application.yml                  # 应用配置
│   └── patterns.yml                     # 内容高亮规则配置
└── pom.xml                              # Maven项目配置
```

### 核心功能模块

#### 1. 文件管理服务 (ViewerService)
- 文件列表获取与递归搜索
- 多格式压缩包支持（ZIP、JAR、GZ）
- 大文件智能截取（尾部读取）
- 文件元数据获取
- 分页内容加载
- 高级搜索（正则表达式、大小写敏感）

#### 2. 认证服务 (AuthService)
- 密钥认证机制
- 临时密钥自动生成
- 会话管理
- 认证状态检查

#### 3. 下载服务 (DownloadService)
- 单文件下载
- 批量文件打包下载
- 流式传输优化

#### 4. 文件索引缓存 (FileIndexCache)
- 大文件行索引缓存
- 快速分页定位
- 内存优化管理

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范
- 遵循 Google Java Style Guide
- 使用 ESLint 检查 JavaScript 代码
- 添加单元测试覆盖新功能
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 作者与贡献者

- **fayfoxcat** - *项目创建者* - [GitHub](https://github.com/fayfoxcat)

查看完整的 [贡献者列表](https://github.com/fayfoxcat/logs/contributors)

## 🔗 相关链接

- [项目主页](https://github.com/fayfoxcat/viewer)
- [问题反馈](https://github.com/fayfoxcat/viewer/issues)
- [版本发布](https://github.com/fayfoxcat/viewer/releases)
- [更新日志](CHANGELOG.md)

## ⭐ 支持项目

如果这个项目对你有帮助，请给它一个 ⭐️！

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/fayfoxcat">fayfoxcat</a></sub>
</div>