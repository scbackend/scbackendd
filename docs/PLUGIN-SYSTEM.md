# 插件系统集成文档

## 概述
插件系统已成功集成到SCBackend服务器中。系统允许动态加载、管理和执行插件，扩展服务器功能。

## 集成位置

### 1. 主入口文件 (`src/index.js`)
- 导入 `PluginManager` 类
- 从配置中读取插件数据库设置
- 在服务启动时创建 `PluginManager` 实例
- 将插件管理器传递给 `Server` 构造函数
- 在优雅关闭时清理插件

### 2. 服务器文件 (`src/server.js`)
- 接收 `plugin` 参数（PluginManager实例）
- 添加了完整的插件管理REST API路由：
  - `GET /plugins` - 列出所有插件
  - `GET /plugin/info/:id` - 获取插件详细信息
  - `POST /plugin/upload/:id` - 上传插件文件
  - `GET /plugin/delete/:id` - 删除插件文件
  - `POST /plugin/enable/:id` - 启用插件
  - `POST /plugin/disable/:id` - 禁用插件
  - `POST /plugin/reload/:id` - 重新加载插件
  - `POST /plugin/enable-for-runner/:id/:runnerId` - 为特定runner启用插件
  - `POST /plugin/disable-for-runner/:id/:runnerId` - 为特定runner禁用插件
  - `GET /runner/plugins/:runnerId` - 获取runner的插件列表

### 3. 插件管理器 (`src/plugin.js`)
- 完整的插件生命周期管理
- 插件状态持久化（SQLite数据库）
- 支持插件配置（YAML文件）
- 提供丰富的插件API

### 4. 管理器 (`src/manager.js`)
- 已支持事件监听系统 (`addEventListener`, `triggerLocalEvent`)
- 已支持扩展注册系统 (`registerExtension`)
- 与插件系统无缝集成

## 插件API

插件可以通过以下API与系统交互：

### 基础信息
- `pluginId` - 插件ID
- `pluginName` - 插件名称
- `pluginVersion` - 插件版本

### 配置管理
- `getConfig()` - 获取插件配置
- `setConfig(key, value)` - 设置配置项

### 事件系统
- `onRunnerEvent(event, callback)` - 监听Runner事件
- `triggerRunnerEvent(runnerId, event, data, callback, field)` - 触发Runner事件

### 扩展注册
- `registerExtension(extension)` - 注册扩展

### Runner管理
- `getRunner(runnerId)` - 获取Runner实例
- `getAllRunners()` - 获取所有Runner
- `getRunnerStatus(runnerId)` - 获取Runner状态
- `getAllRunnersStatus()` - 获取所有Runner状态

### 会话管理
- `sendToSession(sessionId, message)` - 发送消息到会话
- `kickSession(sessionId, reason)` - 踢出会话

### 日志系统
- `log(level, message, context)` - 记录日志

### 插件状态
- `isEnabledForRunner(runnerId)` - 检查插件是否对特定runner启用

## 插件开发

### 插件结构
```javascript
// 必需导出
export const name = '插件名称';
export const version = '1.0.0';
export const description = '插件描述';

// 可选导出
export const defaultConfig = {
  // 默认配置
};

// 必需函数
export function init(config, api) {
  // 插件初始化
}

// 可选函数
export function destroy() {
  // 插件销毁清理
}
```

### 示例插件
参见 `rundir/plugins/example-plugin.js`

### 配置文件
插件配置文件为YAML格式，位于 `rundir/plugins/<plugin-id>.yml`

## 配置

### 主配置文件 (`rundir/config.yml`)
```yaml
plugins:
  type: sqlite
  sqlite:
    filename: plugins.db
  mysql:
    host: localhost
    port: 3306
    user: root
    password: ''
    database: plugins
```

### 环境变量
- `SCBACKEND_PLUGINS_DB_TYPE` - 插件数据库类型
- `SCBACKEND_PLUGINS_SQLITE_FILENAME` - SQLite数据库文件名
- `SCBACKEND_PLUGINS_MYSQL_*` - MySQL数据库配置

## 使用方法

### 1. 启动服务器
```bash
npm start
```

### 2. 管理插件
通过REST API管理插件：

```bash
# 列出插件
curl -H "Authorization: Bearer <token>" http://localhost:3030/plugins

# 上传插件
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/javascript" \
  --data-binary @my-plugin.js \
  http://localhost:3030/plugin/upload/my-plugin

# 启用插件
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"runners": ["runner1", "runner2"]}' \
  http://localhost:3030/plugin/enable/my-plugin

# 获取插件信息
curl -H "Authorization: Bearer <token>" \
  http://localhost:3030/plugin/info/my-plugin
```

### 3. 插件目录
- 插件文件：`rundir/plugins/<plugin-id>.js`
- 配置文件：`rundir/plugins/<plugin-id>.yml`
- 状态数据库：`rundir/plugins.db`

## 注意事项

1. **安全验证**：所有插件管理API都需要Bearer token验证
2. **路径安全**：插件ID和文件路径都经过严格验证，防止路径遍历攻击
3. **错误处理**：所有操作都有适当的错误处理和日志记录
4. **资源清理**：插件在服务器关闭时会被正确清理
5. **状态持久化**：插件启用状态保存在数据库中，重启后保持不变

## 扩展性

插件系统设计为高度可扩展：
- 支持动态加载和卸载
- 支持插件间通信（通过事件系统）
- 支持为特定runner启用插件
- 支持插件配置热重载
- 支持插件依赖管理（通过扩展系统）