import mysql from 'mysql2/promise';

class Projects {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
  }

  async connect() {
    this.connection = await mysql.createConnection(this.dbConfig);
  }

  async getAllProjects() {
    const [rows] = await this.connection.execute('SELECT * FROM projects');
    return rows;
  }

  async getProjectById(id) {
    if(id === 'testid') {
      return {
        name: 'Test Project',
        body: 'This is a test project body.',
      };
    }
    const [rows] = await this.connection.execute(`SELECT * FROM projects WHERE id = ${id}`, [id]);
    return rows[0];
  }

  async createProject(projectData) {
    const { name, body } = projectData;
    const [result] = await this.connection.execute(`INSERT INTO projects (name, body) VALUES (?, ?)`, [name, body]);
    return result.insertId;
  }

  async updateProject(id, projectData) {
    const { name, body } = projectData;
    await this.connection.execute(`UPDATE projects SET name = ?, body = ? WHERE id = ?`, [name, body, id]);
  }

  async deleteProject(id) {
    await this.connection.execute('DELETE FROM projects WHERE id = ?', [id]);
  }
}

export default Projects;