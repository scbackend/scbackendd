import Database from './database.js';

class DatabaseMigrations {
    constructor(database) {
        this.db = database;
    }

    async createLogTables() {
        // 系统日志表
        const systemLogsTableSQL = `
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                level VARCHAR(10) NOT NULL,
                source VARCHAR(50),
                message TEXT NOT NULL,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Runner网络IO日志表
        const runnerNetworkLogsTableSQL = `
            CREATE TABLE IF NOT EXISTS runner_network_logs (
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
            )
        `;

        // 创建索引
        const systemLogsIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
            CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
        `;

        const runnerNetworkLogsIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_runner_network_logs_runner_id ON runner_network_logs(runner_id);
            CREATE INDEX IF NOT EXISTS idx_runner_network_logs_timestamp ON runner_network_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_runner_network_logs_event_type ON runner_network_logs(event_type);
        `;

        try {
            await this.db.query(systemLogsTableSQL);
            await this.db.query(runnerNetworkLogsTableSQL);
            await this.db.query(systemLogsIndexSQL);
            await this.db.query(runnerNetworkLogsIndexSQL);
            
            console.log('[INFO] Log tables created successfully');
        } catch (error) {
            console.error('[ERROR] Failed to create log tables:', error);
            throw error;
        }
    }

    async cleanupOldLogs(daysToKeep = 30) {
        const cleanupSystemLogsSQL = `
            DELETE FROM system_logs 
            WHERE timestamp < datetime('now', ?)
        `;

        const cleanupRunnerNetworkLogsSQL = `
            DELETE FROM runner_network_logs 
            WHERE timestamp < datetime('now', ?)
        `;

        try {
            const daysParam = `-${daysToKeep} days`;
            await this.db.query(cleanupSystemLogsSQL, [daysParam]);
            await this.db.query(cleanupRunnerNetworkLogsSQL, [daysParam]);
            
            console.log(`[INFO] Cleaned up logs older than ${daysToKeep} days`);
        } catch (error) {
            console.error('[ERROR] Failed to cleanup old logs:', error);
        }
    }
}

export default DatabaseMigrations;