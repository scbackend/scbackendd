#!/usr/bin/env node

import Database from './database.js';
import DatabaseMigrations from './database-migrations.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

class LogQuery {
    constructor(configPath = './config.yml') {
        this.configPath = configPath;
        this.db = null;
    }

    async connect() {
        try {
            // 读取配置
            const config = await this.loadConfig();
            
            // 连接数据库
            this.db = new Database(config.database);
            
            // 初始化迁移
            const migrations = new DatabaseMigrations(this.db);
            await migrations.createLogTables();
            
            console.log('✓ Connected to database');
            return true;
            
        } catch (error) {
            console.error(`✗ Failed to connect to database: ${error.message}`);
            return false;
        }
    }

    async loadConfig() {
        // 简单配置加载，实际项目中应该使用Config类
        const fs = await import('fs/promises');
        const yaml = await import('js-yaml');
        
        const content = await fs.readFile(this.configPath, 'utf8');
        return yaml.load(content);
    }

    async querySystemLogs(options = {}) {
        const {
            level = null,
            source = null,
            startTime = null,
            endTime = null,
            limit = 100,
            offset = 0
        } = options;

        let sql = 'SELECT * FROM system_logs WHERE 1=1';
        const params = [];

        if (level) {
            sql += ' AND level = ?';
            params.push(level.toUpperCase());
        }

        if (source) {
            sql += ' AND source LIKE ?';
            params.push(`%${source}%`);
        }

        if (startTime) {
            sql += ' AND timestamp >= ?';
            params.push(startTime);
        }

        if (endTime) {
            sql += ' AND timestamp <= ?';
            params.push(endTime);
        }

        sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        try {
            const logs = await this.db.query(sql, params);
            return logs;
        } catch (error) {
            console.error(`Error querying system logs: ${error.message}`);
            return [];
        }
    }

    async queryRunnerNetworkLogs(options = {}) {
        const {
            runnerId = null,
            eventType = null,
            direction = null,
            startTime = null,
            endTime = null,
            limit = 100,
            offset = 0
        } = options;

        let sql = 'SELECT * FROM runner_network_logs WHERE 1=1';
        const params = [];

        if (runnerId) {
            sql += ' AND runner_id = ?';
            params.push(runnerId);
        }

        if (eventType) {
            sql += ' AND event_type = ?';
            params.push(eventType);
        }

        if (direction) {
            sql += ' AND direction = ?';
            params.push(direction);
        }

        if (startTime) {
            sql += ' AND timestamp >= ?';
            params.push(startTime);
        }

        if (endTime) {
            sql += ' AND timestamp <= ?';
            params.push(endTime);
        }

        sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        try {
            const logs = await this.db.query(sql, params);
            return logs;
        } catch (error) {
            console.error(`Error querying runner network logs: ${error.message}`);
            return [];
        }
    }

    async getStats() {
        try {
            // 系统日志统计
            const systemStats = await this.db.query(`
                SELECT 
                    level,
                    COUNT(*) as count,
                    MIN(timestamp) as first_log,
                    MAX(timestamp) as last_log
                FROM system_logs 
                GROUP BY level
                ORDER BY level
            `);

            // Runner网络IO统计
            const runnerStats = await this.db.query(`
                SELECT 
                    runner_id,
                    event_type,
                    direction,
                    COUNT(*) as count,
                    SUM(data_size) as total_size,
                    MIN(timestamp) as first_log,
                    MAX(timestamp) as last_log
                FROM runner_network_logs 
                GROUP BY runner_id, event_type, direction
                ORDER BY runner_id, event_type
            `);

            // 总体统计
            const totalStats = await this.db.query(`
                SELECT 
                    'system_logs' as table_name,
                    COUNT(*) as total_count
                FROM system_logs
                UNION ALL
                SELECT 
                    'runner_network_logs' as table_name,
                    COUNT(*) as total_count
                FROM runner_network_logs
            `);

            return {
                systemStats,
                runnerStats,
                totalStats
            };
        } catch (error) {
            console.error(`Error getting stats: ${error.message}`);
            return null;
        }
    }

    async cleanupOldLogs(daysToKeep = 30) {
        try {
            const migrations = new DatabaseMigrations(this.db);
            await migrations.cleanupOldLogs(daysToKeep);
            console.log(`✓ Cleaned up logs older than ${daysToKeep} days`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to cleanup logs: ${error.message}`);
            return false;
        }
    }

    formatLog(log, type = 'system') {
        if (type === 'system') {
            const color = this.getLevelColor(log.level);
            const reset = '\x1b[0m';
            return `${color}[${log.level}]${reset} ${log.timestamp} ${log.source ? `[${log.source}]` : ''} ${log.message}`;
        } else {
            return `[${log.runner_id}] ${log.timestamp} ${log.direction.toUpperCase()} ${log.event_type} (${log.data_size || 0} bytes)`;
        }
    }

    getLevelColor(level) {
        switch (level) {
            case 'DEBUG': return '\x1b[36m';
            case 'INFO': return '\x1b[32m';
            case 'WARN': return '\x1b[33m';
            case 'ERROR': return '\x1b[31m';
            case 'FATAL': return '\x1b[35m';
            default: return '\x1b[0m';
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            console.log('✓ Database connection closed');
        }
    }
}

// 命令行接口
async function main() {
    const argv = yargs(hideBin(process.argv))
        .command('system', '查询系统日志', (yargs) => {
            return yargs
                .option('level', {
                    alias: 'l',
                    type: 'string',
                    description: '日志级别 (debug, info, warn, error, fatal)'
                })
                .option('source', {
                    alias: 's',
                    type: 'string',
                    description: '日志来源'
                })
                .option('start', {
                    type: 'string',
                    description: '开始时间 (YYYY-MM-DD HH:MM:SS)'
                })
                .option('end', {
                    type: 'string',
                    description: '结束时间 (YYYY-MM-DD HH:MM:SS)'
                })
                .option('limit', {
                    type: 'number',
                    default: 50,
                    description: '返回条数限制'
                })
                .option('config', {
                    alias: 'c',
                    type: 'string',
                    default: './config.yml',
                    description: '配置文件路径'
                });
        })
        .command('network', '查询Runner网络IO日志', (yargs) => {
            return yargs
                .option('runner', {
                    alias: 'r',
                    type: 'string',
                    description: 'Runner ID'
                })
                .option('event', {
                    alias: 'e',
                    type: 'string',
                    description: '事件类型'
                })
                .option('direction', {
                    alias: 'd',
                    type: 'string',
                    choices: ['in', 'out'],
                    description: '方向 (in/out)'
                })
                .option('start', {
                    type: 'string',
                    description: '开始时间'
                })
                .option('end', {
                    type: 'string',
                    description: '结束时间'
                })
                .option('limit', {
                    type: 'number',
                    default: 50,
                    description: '返回条数限制'
                })
                .option('config', {
                    alias: 'c',
                    type: 'string',
                    default: './config.yml',
                    description: '配置文件路径'
                });
        })
        .command('stats', '查看日志统计', (yargs) => {
            return yargs
                .option('config', {
                    alias: 'c',
                    type: 'string',
                    default: './config.yml',
                    description: '配置文件路径'
                });
        })
        .command('cleanup', '清理旧日志', (yargs) => {
            return yargs
                .option('days', {
                    alias: 'd',
                    type: 'number',
                    default: 30,
                    description: '保留天数'
                })
                .option('config', {
                    alias: 'c',
                    type: 'string',
                    default: './config.yml',
                    description: '配置文件路径'
                });
        })
        .demandCommand(1, '请指定一个命令')
        .help()
        .argv;

    const logQuery = new LogQuery(argv.config);
    
    if (!await logQuery.connect()) {
        process.exit(1);
    }

    try {
        const command = argv._[0];
        
        switch (command) {
            case 'system':
                const systemLogs = await logQuery.querySystemLogs({
                    level: argv.level,
                    source: argv.source,
                    startTime: argv.start,
                    endTime: argv.end,
                    limit: argv.limit
                });
                
                console.log(`\n系统日志 (${systemLogs.length} 条):\n`);
                systemLogs.forEach(log => {
                    console.log(logQuery.formatLog(log, 'system'));
                });
                break;

            case 'network':
                const networkLogs = await logQuery.queryRunnerNetworkLogs({
                    runnerId: argv.runner,
                    eventType: argv.event,
                    direction: argv.direction,
                    startTime: argv.start,
                    endTime: argv.end,
                    limit: argv.limit
                });
                
                console.log(`\nRunner网络IO日志 (${networkLogs.length} 条):\n`);
                networkLogs.forEach(log => {
                    console.log(logQuery.formatLog(log, 'network'));
                });
                break;

            case 'stats':
                const stats = await logQuery.getStats();
                
                console.log('\n=== 日志统计 ===\n');
                
                console.log('系统日志统计:');
                stats.systemStats.forEach(stat => {
                    console.log(`  ${stat.level}: ${stat.count} 条 (${stat.first_log} - ${stat.last_log})`);
                });
                
                console.log('\nRunner网络IO统计:');
                stats.runnerStats.forEach(stat => {
                    console.log(`  ${stat.runner_id} - ${stat.event_type} (${stat.direction}): ${stat.count} 条, ${stat.total_size} 字节`);
                });
                
                console.log('\n总计:');
                stats.totalStats.forEach(stat => {
                    console.log(`  ${stat.table_name}: ${stat.total_count} 条`);
                });
                break;

            case 'cleanup':
                await logQuery.cleanupOldLogs(argv.days);
                break;
        }
        
    } catch (error) {
        console.error(`错误: ${error.message}`);
    } finally {
        await logQuery.close();
    }
}

// 如果是直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default LogQuery;