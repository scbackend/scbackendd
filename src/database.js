import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';

class Database {
    async ensureTableExists(tableName, createTableSQL) {
        let tableExists = false;
        if (this.type === 'sqlite') {
            const rows = await this.query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [tableName]
            );
            tableExists = rows.length > 0;
        } else if (this.type === 'mysql') {
            const rows = await this.query(
                `SHOW TABLES LIKE ?`,
                [tableName]
            );
            tableExists = rows.length > 0;
        } else {
            throw new Error('Unknown database type: ' + this.type);
        }
        if (!tableExists) {
            await this.query(createTableSQL);
        }
    }
    constructor(config) {
        this.type = config.type;
        if (this.type === 'mysql') {
            this.pool = mysql.createPool(config.mysql);
        } else if (this.type === 'sqlite') {
            this.sqlite = new sqlite3.Database(config.sqlite.filename);
        } else {
            throw new Error('Unsupported database type');
        }
    }
    async query(sql, params = []) {
        if (this.type === 'mysql') {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } else if (this.type === 'sqlite') {
            return new Promise((resolve, reject) => {
                this.sqlite.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }
    async close() {
        if (this.type === 'mysql') {
            await this.pool.end();
        } else if (this.type === 'sqlite') {
            await new Promise((resolve, reject) => {
                this.sqlite.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

export default Database;