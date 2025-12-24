# 日志系统重构文档

## 概述

为了解决Runner日志过多、太杂的问题，我们对日志系统进行了全面重构。新的日志系统提供了：

1. **统一归档**：所有日志统一存储到数据库
2. **级别过滤**：支持不同级别的日志输出控制
3. **Runner网络IO分离**：Runner的网络IO日志单独归档到数据库
4. **静默执行**：支持静默模式，减少控制台输出
5. **日志轮转**：自动管理日志文件大小和数量

## 主要改进

### 1. 数据库归档
- 系统日志存储到 `system_logs` 表
- Runner网络IO日志存储到 `runner_network_logs` 表
- 支持SQLite和MySQL数据库
- 自动创建日志表和索引

### 2. 日志级别管理
支持5个日志级别：
- **DEBUG** (0): 调试信息，最详细
- **INFO** (1): 一般信息，默认级别
- **WARN** (2): 警告信息
- **ERROR** (3): 错误信息
- **FATAL** (4): 严重错误信息

### 3. 输出目标控制
可以独立控制日志输出到：
- 控制台 (console)
- 文件 (file)
- 数据库 (database)

### 4. Runner网络IO日志分离
- Runner的输入/输出事件单独记录
- 记录事件类型、方向、数据大小
- 不输出到控制台，只存储到数据库

## 配置说明

### 配置文件 (config.yml)

```yaml
# 日志配置
logging:
  # 控制台输出级别: debug, info, warn, error, fatal
  consoleLevel: info
  
  # 文件输出级别
  fileLevel: warn
  
  # 数据库输出级别
  dbLevel: info
  
  # 静默模式（不输出到控制台）
  silentMode: false
  
  # 是否输出到控制台
  logToConsole: true
  
  # 是否输出到文件
  logToFile: true
  
  # 是否输出到数据库
  logToDatabase: true
  
  # 是否记录Runner网络IO日志
  runnerNetworkIO: true
  
  # 日志文件最大大小（字节）
  maxFileSize: 10485760  # 10MB
  
  # 保留的日志文件数量
  maxFiles: 5
  
  # 日志保留天数
  retentionDays: 30
```

### 配置说明

1. **级别控制**：
   - `consoleLevel`: 控制台显示的日志级别
   - `fileLevel`: 写入文件的日志级别
   - `dbLevel`: 存储到数据库的日志级别

2. **静默模式**：
   - `silentMode: true`: 完全不输出到控制台
   - 适合生产环境或后台运行

3. **Runner网络IO**：
   - `runnerNetworkIO: false`: 关闭Runner网络IO日志记录
   - 减少数据库存储压力

## 使用方法

### 1. 代码中使用日志

```javascript
import logger from './logger.js';

// 基本日志
logger.info('系统启动完成', 'System');
logger.warn('磁盘空间不足', 'System');
logger.error('数据库连接失败', 'Database');

// 带源信息的日志
logger.debug('处理用户请求', 'API');
logger.info('用户登录成功', 'Auth');

// Runner日志
logger.logForRunner('runner-123', '初始化完成');
```

### 2. Runner网络IO日志
自动记录Runner的输入输出事件，无需手动调用。

### 3. 命令行日志查询工具

```bash
# 安装依赖
npm install

# 查询系统日志
npm run logs system -- --level error --limit 20
npm run logs system -- --source "Runner" --start "2024-01-01"

# 查询Runner网络IO日志
npm run logs network -- --runner "runner-123"
npm run logs network -- --event "message" --direction "in"

# 查看日志统计
npm run logs stats

# 清理旧日志（保留30天）
npm run logs cleanup -- --days 30

# 使用自定义配置文件
npm run logs system -- --config /path/to/config.yml
```

### 4. 直接使用命令行工具

```bash
# 系统日志查询
node ./src/log-query.js system --level warn --limit 50

# Runner网络IO查询
node ./src/log-query.js network --runner test-runner --direction out

# 全局安装后使用
scbackendd-logs system --help
```

## 数据库表结构

### system_logs (系统日志表)
```sql
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(10) NOT NULL,
    source VARCHAR(50),
    message TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### runner_network_logs (Runner网络IO日志表)
```sql
CREATE TABLE runner_network_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    runner_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'in' or 'out'
    data_size INTEGER,
    endpoint VARCHAR(255),
    message TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 性能优化建议

### 1. 生产环境配置
```yaml
logging:
  consoleLevel: warn      # 只显示警告及以上
  fileLevel: error        # 只记录错误到文件
  dbLevel: info           # 记录信息到数据库
  silentMode: true        # 静默模式
  runnerNetworkIO: false  # 关闭Runner网络IO日志（如不需要）
```

### 2. 定期清理
```bash
# 每周清理一次旧日志
0 2 * * 0 npm run logs cleanup -- --days 7
```

### 3. 监控建议
- 监控 `system_logs` 表中的 ERROR/FATAL 日志
- 监控 `runner_network_logs` 表的数据增长
- 定期检查日志文件大小

## 故障排除

### 1. 数据库连接失败
- 检查数据库配置
- 检查文件权限
- 查看控制台错误信息

### 2. 日志不显示
- 检查 `silentMode` 设置
- 检查 `consoleLevel` 级别
- 检查日志源是否正确

### 3. 日志文件过大
- 调整 `maxFileSize` 参数
- 减少 `maxFiles` 数量
- 增加清理频率

### 4. 性能问题
- 关闭不必要的日志级别
- 禁用 `runnerNetworkIO` 如不需要
- 增加数据库索引

## 迁移说明

### 从旧版本迁移
1. 备份现有日志文件
2. 更新配置文件
3. 重启服务
4. 新日志将自动存储到数据库

### 向后兼容性
- 旧的 `logger.log()` 方法仍然可用
- `logger.logForRunner()` 方法保持兼容
- 控制台输出格式基本保持一致

## API参考

### Logger类方法
```javascript
// 基本日志
logger.debug(message, source)
logger.info(message, source)
logger.warn(message, source)
logger.error(message, source)
logger.fatal(message, source)

// 通用日志
logger.log(message, level, source, metadata)

// Runner相关
logger.logForRunner(runnerId, message, level)
logger.logRunnerNetworkIO(runnerId, eventType, direction, data, endpoint)

// 配置
logger.setConfig(config)
logger.setSilentMode(enabled)
logger.cleanupOldLogs(daysToKeep)
```

## 注意事项

1. **数据库性能**：大量日志可能影响数据库性能，建议定期清理
2. **磁盘空间**：监控日志文件和数据表大小
3. **隐私安全**：日志中可能包含敏感信息，注意保护
4. **调试模式**：开发时可使用 `consoleLevel: debug` 获取详细日志

## 版本历史

- v1.2.3: 重构日志系统，添加数据库归档和级别过滤
- v1.2.2: 基础日志系统，仅支持控制台和文件输出