import fs from 'fs';
import Database from './database.js';
import logger from './logger.js';

class Projects {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.type = dbConfig.type;
  }

  async connect() {
    this.database = new Database(this.dbConfig);
  }

  async ensureTableExists() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS projects (
        name VARCHAR(64) PRIMARY KEY UNIQUE,
        body LONGTEXT,
        meta TEXT
      )
    `;
    await this.database.query(createTableSQL);
  }

  async getAllProjects() {
    return await this.database.query('SELECT * FROM projects');
  }

  async getProjectById(id) {
    const rows = await this.database.query('SELECT * FROM projects WHERE name = ?', [id]);
    return rows[0];
  }

  async getProjectBodyById(id) {
    try {
      return await fs.promises.readFile(`./projects/${id}.json`, 'utf8');
    } catch (error) {
      logger.error(`[ERROR] Failed to read project file: ${error}`);
      throw error;
    }
  }

  async createProject(projectData) {
    const { name, body } = projectData;
    await this.database.query(
      'INSERT INTO projects (name, body, meta) VALUES (?, ?, ?)',
      [name, body, '{}']
    );
  }

  async updateProject(projectData) {
    const { name, body } = projectData;
    await this.database.query('UPDATE projects SET body = ? WHERE name = ?', [body, name]);
  }

  async updateProjectMeta(projectData) {
    const { name, meta } = projectData;
    await this.database.query('UPDATE projects SET meta = ? WHERE name = ?', [JSON.stringify(meta), name]);
  }

  async deleteProject(id) {
    await this.database.query('DELETE FROM projects WHERE name = ?', [id]);
  }
}

export default Projects;