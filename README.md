# 日志查看器 (Log Viewer)

[![Release Build](https://github.com/fayfoxcat/logs/workflows/Release%20Build/badge.svg)](https://github.com/fayfoxcat/logs/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Java Version](https://img.shields.io/badge/Java-8%2B-blue.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.18-brightgreen.svg)](https://spring.io/projects/spring-boot)

一个基于 Spring Boot 的在线日志查看组件，支持查看、搜索、下载日志文件。

## 特性

- 📁 多目录日志浏览
- 🔍 文件名和内容搜索（支持正则表达式）
- 📦 压缩文件支持（.zip, .gz）
- ⬇️ 单文件和批量下载
- 🎨 日志级别语法高亮
- 🔐 灵活的认证方式（密钥认证/Token认证）
- 🚀 零配置集成，开箱即用

## 快速开始

### 1. 添加依赖

```xml
<dependency>
    <groupId>org.fayfoxcat</groupId>
    <artifactId>logs</artifactId>
    <version>x.x.xx</version>
</dependency>
```

### 2. 配置

最简配置（禁用认证）：

```yaml
logs:
  viewer:
    enable-auth: false  # 禁用认证
    endpoint: /logs     # 访问路径
    paths:              # 日志目录白名单
      - /var/log/app
```

启用密钥认证：

```yaml
logs:
  viewer:
    enable-auth: true
    secret-key: your-secret-key  # 固定密钥（可选，不配置则自动生成临时密钥）
    endpoint: /logs
    paths:
      - /var/log/app
```

### 3. 访问

启动应用后访问：`http://localhost:1098/logs`

## 配置说明

### 基础配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `logs.viewer.enable-auth` | boolean | true | 是否启用认证 |
| `logs.viewer.endpoint` | String | /logs | 访问路径 |
| `logs.viewer.paths` | List<String> | [] | 日志目录白名单 |

### 认证配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `logs.viewer.auth-key` | String | null | 认证密钥（可选） |

### 认证方式

#### 1. 禁用认证（开发环境）

```yaml
logs:
  viewer:
    enable-auth: false
```

#### 2. 密钥认证

**使用固定密钥：**

```yaml
logs:
  viewer:
    enable-auth: true
    secret-key: my-secret-password
```

**使用临时密钥：**

不配置 `auth-key`，系统会在启动时生成临时密钥并打印到日志：

## 开发

### 本地运行

```bash
git clone https://github.com/fayfoxcat/logs.git
cd logs
mvn spring-boot:run
```

访问：`http://localhost:1098/logs`

### 编译打包

```bash
# 打包
mvn clean package

# 安装到本地仓库
mvn install
```

生成文件：
- `target/logs-0.0.1.jar` - 库文件
- `target/logs-0.0.1-exec.jar` - 可执行文件

## 发布版本

### 创建 Release

```bash
# 创建标签
git tag -a 0.0.1 -m "Release version 0.0.1"

# 推送标签
git push origin 0.0.1
```

GitHub Actions 会自动构建并创建 Release。

查看：[Releases 页面](https://github.com/fayfoxcat/logs/releases)

## 技术栈

- Spring Boot 2.7.18
- Thymeleaf
- jQuery 3.6.4
- Java 8+

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 作者

fayfoxcat - [GitHub](https://github.com/fayfoxcat/logs)
