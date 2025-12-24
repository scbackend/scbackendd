import mysql from 'mysql2/promise';
import DatabaseSqlite from 'better-sqlite3';


class Database {
    constructor(config) {
        this.type = config.type;
        if (this.type === 'mysql') {
            this.pool = mysql.createPool(config.mysql);
            this.canMultiExec = config.multipleStatements;
        } else if (this.type === 'sqlite') {
            this.sqlite = new DatabaseSqlite(config.sqlite.filename);
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
        // -------------------------
        // MySQL 分支
        // -------------------------
        if (this.type === 'mysql') {
            const cleaned = sql.trim().replace(/;$/, '');
            const hasMultipleStatements = cleaned.includes(';');

            if (hasMultipleStatements) {
                // MySQL 多语句执行
                // execute() 不支持多语句，必须用 query()
                const [rows] = await this.pool.query(sql, params);
                return rows;
            } else {
                // 单语句 → execute()
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
    }

    async close() {
        if (this.type === 'mysql') {
            await this.pool.end();
        } else if (this.type === 'sqlite') {
            this.sqlite.close();
        }
    }
}

export default Database;