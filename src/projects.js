import fs from 'fs';
import path from 'path';
import Database from './database.js';
import logger from './logger.js';

class Projects {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.type = dbConfig.type;
    this.projectsDir = path.resolve('.', 'projects');
  }

  async connect() {
    this.database = new Database(this.dbConfig);
    await this.ensureTableExists();
    
    // 确保项目目录存在
    await fs.promises.mkdir(this.projectsDir, { recursive: true });
  }

  async ensureTableExists() {
    await this.database.ensureTableExists(
      'projects',
      `CREATE TABLE projects (
        name VARCHAR(64) PRIMARY KEY UNIQUE,
        body LONGTEXT,
        meta TEXT
      )`
    );
  }

  async getAllProjects() {
    return await this.database.query('SELECT * FROM projects');
  }

  async getProjectById(id) {
    // 验证项目ID
    if (!this.validateProjectId(id)) {
      throw new Error('Invalid project ID');
    }
    
    const rows = await this.database.query('SELECT * FROM projects WHERE name = ?', [id]);
    return rows[0];
  }

  async getProjectBodyById(id) {
    // 验证项目ID
    if (!this.validateProjectId(id)) {
      throw new Error('Invalid project ID');
    }
    
    const filePath = path.join(this.projectsDir, `${id}.json`);
    
    // 路径安全检查
    if (!this.isSafePath(filePath, this.projectsDir)) {
      throw new Error('Invalid file path');
    }
    
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to read project file: ${error.message}`, 'Projects');
      throw error;
    }
  }

  async createProject(projectData) {
    const { name, body } = projectData;
    
    // 验证项目名称
    if (!this.validateProjectId(name)) {
      throw new Error('Invalid project name');
    }
    
    await this.database.query(
      'INSERT INTO projects (name, body, meta) VALUES (?, ?, ?)',
      [name, body, '{}']
    );
  }

  async updateProject(projectData) {
    const { name, body } = projectData;
    
    // 验证项目名称
    if (!this.validateProjectId(name)) {
      throw new Error('Invalid project name');
    }
    
    await this.database.query('UPDATE projects SET body = ? WHERE name = ?', [body, name]);
  }

  async updateProjectMeta(projectData) {
    const { name, meta } = projectData;
    
    // 验证项目名称
    if (!this.validateProjectId(name)) {
      throw new Error('Invalid project name');
    }
    
    await this.database.query('UPDATE projects SET meta = ? WHERE name = ?', [JSON.stringify(meta), name]);
  }

  async deleteProject(id) {
    // 验证项目ID
    if (!this.validateProjectId(id)) {
      throw new Error('Invalid project ID');
    }
    
    await this.database.query('DELETE FROM projects WHERE name = ?', [id]);
    
    // 删除对应的文件
    const filePath = path.join(this.projectsDir, `${id}.json`);
    if (this.isSafePath(filePath, this.projectsDir)) {
      try {
        await fs.promises.unlink(filePath).catch(() => {
          // 文件可能不存在，忽略错误
        });
      } catch (error) {
        logger.warn(`Failed to delete project file: ${error.message}`, 'Projects');
      }
    }
  }

  // 验证项目ID是否安全
  validateProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') return false;
    // 只允许字母、数字、下划线、连字符和点号
    return /^[\w\-\.]+$/.test(projectId) && !projectId.includes('..');
  }

  // 检查路径是否安全（防止路径遍历）
  isSafePath(filePath, baseDir) {
    const normalizedPath = path.normalize(filePath);
    const normalizedBaseDir = path.normalize(baseDir);
    return normalizedPath.startsWith(normalizedBaseDir);
  }
}

export default Projects;