# Scbackend

Scbackend 是一个将 Scratch 作为后端开发语言的创新平台，支持图形化编程驱动服务端逻辑，适合教育、创意编程和低代码场景。

[English README](docs/README-EN.md)

---

## 特性
- 使用 Scratch 图形化编程构建后端服务
- 支持 TurboWarp/Scratch3 项目导入
- 支持自定义扩展和事件通信
- 内置 WebSocket 服务，便于实时交互
- 支持 SQLite/MySQL 数据库
- **增强的日志系统**：支持数据库归档、级别过滤和静默模式
- 日志与项目管理功能完善
- 插件系统支持，可扩展性强

## 安装前置条件
- Node.js >= 18
- Git

## 快速开始
1. 克隆仓库：
   ```bash
   git clone https://github.com/scbackend/scbackendd.git
   ```
2. 进入项目目录并安装依赖：
   ```bash
   cd scbackendd
   npm install
   ```
3. 链接命令行工具（开发模式）：
   ```bash
   npm link
   ```
4. 在你的工作目录下运行：
   ```bash
   scbackendd
   ```
   首次运行会生成配置文件 `config.yml`，可按需修改。

## 增强的日志系统 (v1.2.3+)

### 主要特性
- **统一归档**：所有日志自动存储到数据库
- **级别过滤**：支持 DEBUG, INFO, WARN, ERROR, FATAL 级别
- **Runner网络IO分离**：Runner的网络IO日志单独归档到数据库
- **静默执行**：支持静默模式，减少控制台输出
- **日志轮转**：自动管理日志文件大小和数量

### 配置示例
```yaml
logging:
  consoleLevel: info      # 控制台输出级别
  fileLevel: warn        # 文件输出级别
  dbLevel: info          # 数据库输出级别
  silentMode: false      # 静默模式
  runnerNetworkIO: true  # 记录Runner网络IO日志
  retentionDays: 30      # 日志保留天数
```

### 日志查询工具
```bash
# 查询系统日志
npm run logs system -- --level error --limit 20

# 查询Runner网络IO日志
npm run logs network -- --runner "runner-123"

# 查看日志统计
npm run logs stats

# 清理旧日志
npm run logs cleanup -- --days 7
```

详细文档请查看 [LOGGING-SYSTEM.md](docs/LOGGING-SYSTEM.md)

## 生产部署
雨云是我们的官方合作伙伴!点击下方按钮一键部署在雨云，新用户免费试用15天，并首充双倍到账
还有首月5折券和季付七折券，快快使用下方链接部署吧!


[![通过雨云一键部署](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7126/vip678_)


也可以使用我们构建好的docker镜像
```bash
docker run ghcr.io/scbackend/scbackendd
```
然后根据需要映射端口，并持久化/workspace目录

## 配置说明
- 默认配置文件路径：`./config.yml`
- 支持 SQLite 和 MySQL，可在配置文件中切换
- 端口、账号密码等均可自定义
- **新增日志配置**：支持详细的日志级别和输出控制

## 常见命令
- 启动服务：`scbackendd`
- 查看所有项目：`GET /projects`
- 添加/移除 Runner：`GET /runner/add/:id`、`GET /runner/remove/:id`
- 项目导入/导出：支持 TurboWarp/Scratch3 格式
- **日志查询**：`npm run logs` 或 `scbackendd-logs`

## 典型输出
服务启动成功后，控制台会显示：
```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
[INFO] Logging system initialized with database support
```

## 测试日志系统
```bash
# 运行日志系统测试
node test-logging.js
```

## 贡献与反馈
欢迎提交 Issue 或 PR，或加入交流群讨论。

---

## License
本项目采用 MPL 协议。

## 如果这个项目对你有用，请给个star吧