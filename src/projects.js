import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';

class Projects {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.type = dbConfig.type;
    switch (this.type) {
      case 'mysql': this.dbConfig = dbConfig.mysql; break;
      case 'sqlite': this.dbConfig = dbConfig.sqlite; break;
      default: throw new Error('Unsupported database type');
    }
    this.connection = null;
  }

  async connect() {
    if (this.type === 'mysql') {
      this.connection = await mysql.createConnection(this.dbConfig);
    } else if (this.type === 'sqlite') {
      this.connection = new sqlite3.Database(this.dbConfig.filename);
      // Promisify sqlite3 methods
      this.connection.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
        this.connection.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
      this.connection.allAsync = (sql, params = []) => new Promise((resolve, reject) => {
        this.connection.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      this.connection.getAsync = (sql, params = []) => new Promise((resolve, reject) => {
        this.connection.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } else {
      throw new Error('Unsupported database type');
    }
  }

  async ensureTableExists() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS projects (
        name VARCHAR(64) PRIMARY KEY UNIQUE,
        body LONGTEXT,
        meta TEXT
      )
    `;
    if (this.type === 'mysql') {
      await this.connection.execute(createTableSQL);
    } else if (this.type === 'sqlite') {
      await this.connection.runAsync(createTableSQL);
    }
  }

  async getAllProjects() {
    if (this.type === 'mysql') {
      const [rows] = await this.connection.execute('SELECT * FROM projects');
      return rows;
    } else if (this.type === 'sqlite') {
      return await this.connection.allAsync('SELECT * FROM projects');
    }
  }

  async getProjectById(id) {
    if (this.type === 'mysql') {
      const [rows] = await this.connection.execute('SELECT * FROM projects WHERE name = ?', [id]);
      return rows[0];
    } else if (this.type === 'sqlite') {
      return await this.connection.getAsync('SELECT * FROM projects WHERE name = ?', [id]);
    }
  }

  async createProject(projectData) {
    const { name, body } = projectData;
    if (this.type === 'mysql') {
      const [result] = await this.connection.execute(
        'INSERT INTO projects (name, body, meta) VALUES (?, ?, ?)',
        [name, body, '{}']
      );
      return result.insertId;
    } else if (this.type === 'sqlite') {
      const res = await this.connection.runAsync(
        'INSERT INTO projects (name, body, meta) VALUES (?, ?, ?)',
        [name, body, '{}']
      );
      return res.lastID;
    }
  }

  async updateProject(projectData) {
    const { name, body } = projectData;
    if (this.type === 'mysql') {
      await this.connection.execute('UPDATE projects SET body = ? WHERE name = ?', [body, name]);
    } else if (this.type === 'sqlite') {
      await this.connection.runAsync('UPDATE projects SET body = ? WHERE name = ?', [body, name]);
    }
  }

  async updateProjectMeta(projectData) {
    const { name, meta } = projectData;
    if (this.type === 'mysql') {
      await this.connection.execute('UPDATE projects SET meta = ? WHERE name = ?', [JSON.stringify(meta), name]);
    } else if (this.type === 'sqlite') {
      await this.connection.runAsync('UPDATE projects SET meta = ? WHERE name = ?', [JSON.stringify(meta), name]);
    }
  }

  async deleteProject(id) {
    if (this.type === 'mysql') {
      await this.connection.execute('DELETE FROM projects WHERE name = ?', [id]);
    } else if (this.type === 'sqlite') {
      await this.connection.runAsync('DELETE FROM projects WHERE name = ?', [id]);
    }
  }
}

export default Projects;