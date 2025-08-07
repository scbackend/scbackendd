# Scbackend

一个将 Scratch 用作后端开发语言的软件。

[English](docs/README-EN.md)

## 前置条件
请确保您的设备已正确安装 Node.js 和 Git。

## 使用说明
1. 在目标目录下执行以下命令以克隆项目仓库：
   ```
   git clone https://github.com/scbackend/scbackendd.git
   ```
2. 进入 `scbackendd` 目录，运行：
   ```
   npm link
   ```
3. 切换至您的工作目录，执行：
   ```
   scbackendd
   ```
   首次运行将在当前目录下生成配置文件，您可根据实际需求进行修改。

当控制台显示如下信息时，服务已成功启动：
```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
```

如仅需部署服务，可使用以下命令进行全局安装：
```
npm install scbackendd --global
```
随后在工作目录下运行：
```
scbackendd
```
即可启动服务。