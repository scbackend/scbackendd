import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';

class Database {
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