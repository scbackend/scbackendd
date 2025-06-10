# Scbackend

一个让scratch变成后端语言的软件

[English](README-EN.md)

## 前置准备
请确保你的设备正确安装了Node.js与git

## 如何使用
切换到你想要放置该服务的目录，输入`git clone https://github.com/scbackend/scbackendd.git`

切换到scbackendd目录,输入`npm link`

切换到工作目录,输入`scbackendd`,首次使用会在该目录下生成配置文件,可以根据个人情况修改

当控制台输入以下两行时,服务正常运行

```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
```