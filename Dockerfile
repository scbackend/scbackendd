# 使用 Node.js 18 官方镜像作为基础镜像
FROM node:18

# 设置工作目录为 /workspace
WORKDIR /workspace

# 将当前目录除 Dockerfile 外的所有文件复制到 /src
COPY . /src
RUN rm /src/Dockerfile

# 进入 /src 目录并执行 npm link
RUN cd /src && npm link

# 启动容器时执行 scbackendd
CMD ["scbackendd"]
