import mysql from 'mysql2/promise';
import DatabaseSqlite from 'better-sqlite3';


class Database {
    constructor(config) {
        this.type = config.type;
        if (this.type === 'mysql') {
            this.pool = mysql.createPool(config.mysql);
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
        if (this.type === 'mysql') {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } else if (this.type === 'sqlite') {
            // better-sqlite3 同步 API
            const stmt = this.sqlite.prepare(sql);
            // 判断是查询还是执行
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