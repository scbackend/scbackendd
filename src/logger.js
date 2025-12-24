import fs from 'fs/promises';

// 日志级别定义
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

// 日志级别名称映射
const LEVEL_NAMES = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR',
    4: 'FATAL'
};

class Logger {
    constructor(config = {}) {
        this.config = {
            consoleLevel: config.consoleLevel || LOG_LEVELS.INFO, // 控制台输出级别
            fileLevel: config.fileLevel || LOG_LEVELS.WARN,       // 文件输出级别
            dbLevel: config.dbLevel || LOG_LEVELS.INFO,          // 数据库输出级别
            silentMode: config.silentMode || false,              // 静默模式
            logToConsole: config.logToConsole !== false,         // 是否输出到控制台
            logToFile: config.logToFile || true,                 // 是否输出到文件
            logToDatabase: config.logToDatabase || true,         // 是否输出到数据库
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: config.maxFiles || 5                       // 保留5个日志文件
        };

        this.db = null;
        this.dbMigrations = null;
        this.initialized = false;
    }

    // 设置数据库连接
    setDatabase(database, migrations) {
        this.db = database;
        this.dbMigrations = migrations;
        this.initialized = true;
    }

    // 主日志方法
    async log(message, level = 'info', source = null, metadata = null) {
        const levelNum = typeof level === 'string' ? LOG_LEVELS[level.toUpperCase()] : level;
        const levelName = LEVEL_NAMES[levelNum] || 'INFO';
        const timestamp = new Date().toISOString();
        const sourceStr = source ? `[${source}] ` : '';

        // 构建日志条目
        const logEntry = {
            timestamp,
            level: levelName,
            source,
            message: String(message),
            metadata: metadata ? JSON.stringify(metadata) : null
        };

        // 控制台输出（根据级别和静默模式）
        if (this.config.logToConsole && !this.config.silentMode && levelNum >= this.config.consoleLevel) {
            const color = this.getLevelColor(levelName);
            console.log(`${color}[${levelName}][${timestamp}]${sourceStr} ${message}\x1b[0m`);
        }

        // 文件输出（根据级别）
        if (this.config.logToFile && levelNum >= this.config.fileLevel) {
            await this.writeToFile(logEntry);
        }

        // 数据库输出（根据级别）
        if (this.config.logToDatabase && this.initialized && levelNum >= this.config.dbLevel) {
            await this.writeToDatabase(logEntry);
        }

        return logEntry;
    }

    // 获取日志级别颜色
    getLevelColor(level) {
        switch (level) {
            case 'DEBUG': return '\x1b[36m'; // 青色
            case 'INFO': return '\x1b[32m';  // 绿色
            case 'WARN': return '\x1b[33m';  // 黄色
            case 'ERROR': return '\x1b[31m'; // 红色
            case 'FATAL': return '\x1b[35m'; // 紫色
            default: return '\x1b[0m';       // 默认
        }
    }

    // 写入文件
    async writeToFile(logEntry) {
        try {
            await fs.mkdir('logs', { recursive: true });
            
            const logLine = `[${logEntry.level}][${logEntry.timestamp}]${logEntry.source ? `[${logEntry.source}]` : ''} ${logEntry.message}\n`;
            
            // 检查文件大小并轮转
            await this.rotateLogFile('logs/server.log');
            
            await fs.appendFile('logs/server.log', logLine);
        } catch (error) {
            // 文件写入失败时静默处理
            console.error(`[ERROR] Failed to write log to file: ${error.message}`);
        }
    }

    // 日志文件轮转
    async rotateLogFile(filePath) {
        try {
            const stats = await fs.stat(filePath).catch(() => null);
            
            if (stats && stats.size > this.config.maxFileSize) {
                // 轮转现有日志文件
                for (let i = this.config.maxFiles - 1; i > 0; i--) {
                    const oldFile = `${filePath}.${i}`;
                    const newFile = `${filePath}.${i + 1}`;
                    
                    if (await fs.access(oldFile).then(() => true).catch(() => false)) {
                        await fs.rename(oldFile, newFile);
                    }
                }
                
                // 重命名当前日志文件
                await fs.rename(filePath, `${filePath}.1`);
                
                // 创建新的日志文件
                await fs.writeFile(filePath, '');
            }
        } catch (error) {
            // 轮转失败时静默处理
        }
    }

    // 写入数据库
    async writeToDatabase(logEntry) {
        if (!this.db || !this.initialized) return;

        try {
            const sql = `
                INSERT INTO system_logs (timestamp, level, source, message, metadata)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await this.db.query(sql, [
                logEntry.timestamp,
                logEntry.level,
                logEntry.source,
                logEntry.message,
                logEntry.metadata
            ]);
        } catch (error) {
            // 数据库写入失败时静默处理
            console.error(`[ERROR] Failed to write log to database: ${error.message}`);
        }
    }

    // Runner网络IO日志
    async logRunnerNetworkIO(runnerId, eventType, direction, data = null, endpoint = null) {
        if (!this.db || !this.initialized) return;

        try {
            const timestamp = new Date().toISOString();
            const dataSize = data ? (typeof data === 'string' ? data.length : JSON.stringify(data).length) : 0;
            
            const sql = `
                INSERT INTO runner_network_logs 
                (timestamp, runner_id, event_type, direction, data_size, endpoint, message, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.db.query(sql, [
                timestamp,
                runnerId,
                eventType,
                direction,
                dataSize,
                endpoint,
                data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null,
                null
            ]);
        } catch (error) {
            // 静默处理数据库错误
        }
    }

    // Runner日志（兼容旧方法）
    async logForRunner(runnerId, message, level = 'info') {
        const source = `Runner ${runnerId}`;
        return this.log(message, level, source);
    }

    // 便捷方法
    debug(message, source = null) {
        return this.log(message, 'debug', source);
    }

    info(message, source = null) {
        return this.log(message, 'info', source);
    }

    warn(message, source = null) {
        return this.log(message, 'warn', source);
    }

    error(message, source = null) {
        return this.log(message, 'error', source);
    }

    fatal(message, source = null) {
        return this.log(message, 'fatal', source);
    }

    // 设置配置
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    // 启用/禁用静默模式
    setSilentMode(enabled) {
        this.config.silentMode = enabled;
    }

    // 清理旧日志
    async cleanupOldLogs(daysToKeep = 30) {
        if (this.dbMigrations) {
            await this.dbMigrations.cleanupOldLogs(daysToKeep);
        }
    }
}

// 创建默认logger实例
const logger = new Logger();

// 导出
export default logger;
export { Logger, LOG_LEVELS };