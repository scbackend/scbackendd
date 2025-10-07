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
- 日志与项目管理功能完善

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

## 生产部署
可全局安装：
```bash
npm install scbackendd --global
```
然后在任意目录下运行：
```bash
scbackendd
```

## 配置说明
- 默认配置文件路径：`./config.yml`
- 支持 SQLite 和 MySQL，可在配置文件中切换
- 端口、账号密码等均可自定义

## 常见命令
- 启动服务：`scbackendd`
- 查看所有项目：`GET /projects`
- 添加/移除 Runner：`GET /runner/add/:id`、`GET /runner/remove/:id`
- 项目导入/导出：支持 TurboWarp/Scratch3 格式

## 典型输出
服务启动成功后，控制台会显示：
```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
```

## 贡献与反馈
欢迎提交 Issue 或 PR，或加入交流群讨论。

---

## License
本项目采用 MPL 协议。

## 如果这个项目对你有用，请给个star吧