import mysql from 'mysql2/promise';
import DatabaseSqlite from 'better-sqlite3';

class Database {
    constructor(config) {
        this.type = config.type;
        if (this.type === 'mysql') {
            this.pool = mysql.createPool({
                ...config.mysql,
                connectionLimit: 10,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            });
            this.canMultiExec = config.multipleStatements;
        } else if (this.type === 'sqlite') {
            this.sqlite = new DatabaseSqlite(config.sqlite.filename);
            // 启用WAL模式提高性能
            this.sqlite.pragma('journal_mode = WAL');
            this.sqlite.pragma('synchronous = NORMAL');
        } else {
            throw new Error('Unsupported database type');
        }
    }

    async ensureTableExists(tableName, createTableSQL) {
        let tableExists = false;
        if (this.type === 'sqlite') {
            const row = this.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            tableExists = !!row;
        } else if (this.type === 'mysql') {
            const rows = await this.query(`SHOW TABLES LIKE ?`, [tableName]);
            tableExists = rows.length > 0;
        } else {
            throw new Error('Unknown database type: ' + this.type);
        }
        if (!tableExists) {
            await this.query(createTableSQL);
        }
    }

    async query(sql, params = []) {
        // 验证SQL语句
        if (typeof sql !== 'string' || sql.trim() === '') {
            throw new Error('Invalid SQL statement');
        }

        // 验证参数
        if (!Array.isArray(params)) {
            throw new Error('Parameters must be an array');
        }

        try {
            // -------------------------
            // MySQL 分支
            // -------------------------
            if (this.type === 'mysql') {
                const cleaned = sql.trim().replace(/;$/, '');
                const hasMultipleStatements = cleaned.includes(';');

                if (hasMultipleStatements) {
                    // MySQL 多语句执行 - 使用参数化查询
                    // 注意：多语句查询需要特殊处理参数
                    const [rows] = await this.pool.query(sql, params);
                    return rows;
                } else {
                    // 单语句 → execute() 使用参数化查询防止SQL注入
                    const [rows] = await this.pool.execute(sql, params);
                    return rows;
                }
            }

            // -------------------------
            // SQLite 分支
            // -------------------------
            if (this.type === 'sqlite') {
                const cleaned = sql.trim().replace(/;$/, '');
                const hasMultipleStatements = cleaned.includes(';');

                if (hasMultipleStatements) {
                    if (params.length > 0) {
                        throw new Error("SQLite exec() 不支持参数绑定，请拆分 SQL 或改为单语句 prepare()");
                    }
                    this.sqlite.exec(sql);
                    return { changes: 0 };
                }

                const stmt = this.sqlite.prepare(sql);

                if (/^\s*select/i.test(sql)) {
                    return stmt.all(...params);
                } else {
                    return stmt.run(...params);
                }
            }
        } catch (error) {
            // 记录数据库错误但不暴露敏感信息
            console.error(`Database query error: ${error.message}`);
            throw new Error('Database operation failed');
        }
    }

    async close() {
        try {
            if (this.type === 'mysql') {
                await this.pool.end();
            } else if (this.type === 'sqlite') {
                this.sqlite.close();
            }
        } catch (error) {
            console.error(`Error closing database connection: ${error.message}`);
        }
    }

    // 事务支持
    async transaction(callback) {
        if (this.type === 'mysql') {
            const connection = await this.pool.getConnection();
            try {
                await connection.beginTransaction();
                const result = await callback(connection);
                await connection.commit();
                return result;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } else if (this.type === 'sqlite') {
            try {
                this.sqlite.prepare('BEGIN TRANSACTION').run();
                const result = await callback(this);
                this.sqlite.prepare('COMMIT').run();
                return result;
            } catch (error) {
                this.sqlite.prepare('ROLLBACK').run();
                throw error;
            }
        }
    }
}

export default Database;