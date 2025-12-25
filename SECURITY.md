# 安全配置指南

## 安全最佳实践

### 1. 环境变量配置
永远不要在代码中硬编码敏感信息。使用环境变量：

```bash
# 必需的环境变量
export SCBACKEND_USERNAME=admin
export SCBACKEND_PASSWORD=strong_password_here
export SCBACKEND_DB_PASSWORD=database_password

# 可选的环境变量
export SCBACKEND_DASH_PORT=3030
export SCBACKEND_SERVICE_PORT=3031
export SCBACKEND_LOG_LEVEL=info
```

### 2. 文件权限
确保配置文件有适当的权限：
```bash
# 仅所有者可读写
chmod 600 config.yml
chmod 600 *.db
```

### 3. 网络安全
- 使用HTTPS反向代理（如Nginx）
- 配置防火墙规则
- 限制访问IP范围
- 启用CORS策略

### 4. 数据库安全
- 使用强密码
- 限制数据库用户权限
- 定期备份
- 启用SSL连接（MySQL）

### 5. 日志安全
- 不要记录敏感信息（密码、令牌等）
- 定期轮转和清理日志
- 保护日志文件权限

## 安全配置示例

### Nginx反向代理配置
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 安全头部
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### 系统服务配置（systemd）
```ini
[Unit]
Description=ScBackend Server
After=network.target

[Service]
Type=simple
User=scbackend
Group=scbackend
WorkingDirectory=/opt/scbackend
Environment="NODE_ENV=production"
Environment="SCBACKEND_PASSWORD=your_secure_password"
Environment="SCBACKEND_DB_PASSWORD=your_db_password"
ExecStart=/usr/bin/node /opt/scbackend/src/index.js
Restart=always
RestartSec=10

# 安全限制
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/scbackend/logs /opt/scbackend/rundir

[Install]
WantedBy=multi-user.target
```

## 安全审计

### 定期检查
1. 检查依赖安全漏洞：
```bash
npm audit
npx audit-ci --critical
```

2. 更新依赖：
```bash
npm outdated
npm update
```

3. 检查文件权限：
```bash
find . -type f -name "*.yml" -o -name "*.db" | xargs ls -la
```

### 监控和告警
- 监控失败登录尝试
- 监控异常请求模式
- 设置磁盘空间告警
- 监控内存使用情况

## 应急响应

### 发现安全漏洞时
1. 立即停止服务
2. 备份当前状态
3. 分析漏洞影响
4. 应用修复补丁
5. 更新所有密码和令牌
6. 重新启动服务
7. 监控异常行为

### 联系信息
- 安全问题报告：security@example.com
- 紧急联系方式：+1-XXX-XXX-XXXX

## 版本更新
定期更新到最新版本以获取安全修复：
```bash
git pull origin main
npm install
npm run build
```

---

**重要提示**：此文档应定期更新以反映最新的安全最佳实践。