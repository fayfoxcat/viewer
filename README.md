# 日志查看器 (Log Viewer)

[![Release Build](https://github.com/fayfoxcat/logs/workflows/Release%20Build/badge.svg)](https://github.com/fayfoxcat/logs/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Java Version](https://img.shields.io/badge/Java-8%2B-blue.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.18-brightgreen.svg)](https://spring.io/projects/spring-boot)

一个现代化的在线日志查看组件，基于 Spring Boot 构建，提供强大的日志浏览、搜索和管理功能。

## ✨ 核心特性

### 📁 文件管理
- **多目录支持**: 配置多个日志目录，统一管理
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
    <artifactId>logs</artifactId>
    <version>0.0.1</version>
</dependency>
```

### 2. 基础配置

**最简配置（开发环境）**：
```yaml
logs:
  viewer:
    enable-auth: false  # 禁用认证
    paths:
      - ./logs          # 项目日志目录
      - /var/log/app    # 系统日志目录
```

**生产环境配置**：
```yaml
logs:
  viewer:
    enable-auth: true
    secret-key: "your-secure-password-here"
    endpoint: /admin/logs
    paths:
      - /var/log/application
      - /opt/app/logs
```

### 3. 启动访问

启动应用后访问：`http://localhost:8080/logs`

## 📖 详细配置

### 核心配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `logs.viewer.endpoint` | String | `/logs` | 访问端点路径 |
| `logs.viewer.enable-auth` | Boolean | `true` | 是否启用认证保护 |
| `logs.viewer.secret-key` | String | `null` | 认证密钥（留空自动生成） |
| `logs.viewer.paths` | List | `[]` | 允许访问的目录白名单 |
| `logs.viewer.max-file-size-mb` | Integer | `10` | 大文件阈值（MB），超过此大小只显示尾部 |
| `logs.viewer.tail-lines` | Integer | `10000` | 大文件显示的尾部行数 |

### 认证配置详解

#### 🔓 开发模式（禁用认证）
```yaml
logs:
  viewer:
    enable-auth: false
```
> ⚠️ **安全提醒**: 仅适用于开发环境或内网环境

#### 🔐 密钥认证模式

**固定密钥**（推荐生产环境）：
```yaml
logs:
  viewer:
    enable-auth: true
    secret-key: "MySecurePassword123!"
```

**临时密钥**（快速测试）：
```yaml
logs:
  viewer:
    enable-auth: true
    # 不配置 secret-key，系统自动生成并输出到控制台
```

### 路径配置示例

```yaml
logs:
  viewer:
    paths:
      # 绝对路径
      - /var/log/application
      - C:\logs\app
      
      # 相对路径
      - ./logs
      - ../shared-logs
      
      # 网络路径（Windows）
      - \\server\share\logs
      
      # 多环境配置
      - ${LOG_DIR:/opt/app/logs}  # 环境变量，默认值
```

## 🛠️ 高级功能

### 实时刷新
- 自动检测文件变化
- 智能滚动到底部
- 可配置刷新间隔
- 支持暂停/恢复

### 文件操作
- 单文件下载
- 批量文件打包下载
- 压缩包内文件预览
- 大文件尾部截取（>10MB）

### 搜索优化
- 防抖输入，减少服务器压力
- 搜索结果缓存
- 正则表达式语法检查
- 搜索历史记录

### 性能优化
- 虚拟滚动（大文件列表）
- 分页加载（内容渲染）
- 静态资源缓存
- Gzip 压缩传输

## 🔧 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/fayfoxcat/logs.git
cd logs

# 启动开发服务器
mvn spring-boot:run

# 访问应用
open http://localhost:1098/logs
```

### 构建部署

```bash
# 编译打包
mvn clean package

# 生成文件
# target/logs-0.0.1.jar        - 库文件（集成使用）
# target/logs-0.0.1-exec.jar   - 可执行文件（独立运行）

# 独立运行
java -jar target/logs-0.0.1-exec.jar
```

### 自定义扩展

#### 自定义认证
```java
@Component
public class CustomAuthService extends AuthService {
    @Override
    public boolean validateKey(String inputKey) {
        // 实现自定义认证逻辑
        return customValidation(inputKey);
    }
}
```

#### 自定义文件处理
```java
@Component
public class CustomLogViewerService extends LogViewerService {
    @Override
    public String readFileContent(String filePath) throws IOException {
        // 实现自定义文件读取逻辑
        return customFileReader(filePath);
    }
}
```

## 📊 技术架构

### 后端技术栈
- **Spring Boot 2.7.18**: 核心框架
- **Spring Security**: 安全认证（可选）
- **Thymeleaf**: 模板引擎
- **SLF4J + Logback**: 日志框架

### 前端技术栈
- **jQuery 3.6.4**: DOM 操作和 AJAX
- **Ant Design**: UI 设计语言
- **CSS Grid/Flexbox**: 现代布局
- **ES6+ JavaScript**: 模块化开发

### 架构特点
- **模块化设计**: 前后端分离，组件化开发
- **零侵入集成**: 自动配置，无需修改现有代码
- **高性能**: 流式处理，分页加载，缓存优化
- **安全可靠**: 路径白名单，会话管理，输入验证

## 🔍 故障排除

### 常见问题

**Q: 无法访问日志文件**
```
A: 检查 logs.viewer.paths 配置是否包含目标目录
   确保应用有读取权限
```

**Q: 认证失败**
```
A: 检查 secret-key 配置
   查看控制台输出的临时密钥
   确认 enable-auth 设置正确
```

**Q: 大文件加载慢**
```
A: 系统自动截取大文件尾部（>10MB）
   可通过实时刷新查看最新内容
   考虑使用日志轮转减小文件大小
```

**Q: 搜索结果不准确**
```
A: 检查正则表达式语法
   确认大小写敏感设置
   尝试使用关键字搜索
```

### 日志调试

启用详细日志：
```yaml
logging:
  level:
    org.fayfoxcat.log: DEBUG
```

## 📈 性能基准

| 操作 | 文件大小 | 响应时间 | 内存占用 |
|------|----------|----------|----------|
| 文件列表 | 1000+ 文件 | <100ms | <10MB |
| 内容加载 | 10MB | <500ms | <50MB |
| 搜索 | 100MB | <2s | <100MB |
| 下载 | 1GB | 流式传输 | <20MB |

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

- [项目主页](https://github.com/fayfoxcat/logs)
- [问题反馈](https://github.com/fayfoxcat/logs/issues)
- [版本发布](https://github.com/fayfoxcat/logs/releases)
- [更新日志](CHANGELOG.md)

## ⭐ 支持项目

如果这个项目对你有帮助，请给它一个 ⭐️！

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/fayfoxcat">fayfoxcat</a></sub>
</div>
