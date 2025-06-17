import http from 'http';

class Server {
  constructor(port,projects) {
    this.port = port;
    this.projects = projects;
  }
  async handler(req, res) {
    const { method, url, headers } = req;
    console.log(`[INFO] Received request: ${method} ${url}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (method === 'GET' && /\/project\/*/.test(url)) {
      console.log(`[INFO] Responding to project request: ${url}`);
      const projectId = url.split('/')[2];
        try {
            const project = await this.projects.getProjectById(projectId);
            if (project) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(project));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Project not found\n');
            }
        } catch (error) {
            console.error(`[ERROR] Error fetching project: ${error.message}`);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error\n');
        }
        finally {
            return;
        }
    }
    if (method === 'POST' && url === '/create') {
      console.log(`[INFO] Responding to create request: ${url}`);
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        console.log(`[INFO] Received body: ${body}`);
        try {
          const projectData = JSON.parse(body);
          if (!projectData.name || !projectData.body) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Project name and body are required\n');
            return;
          }
          await this.projects.createProject(projectData);
          console.log(`[INFO] Project created: ${projectData.name}`);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Create project success\n');
        } catch (error) {
          console.error(`[ERROR] Error creating project: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error\n');
          return;
        }
        return;
      });
      return;
    }
    if (method === 'GET' && url === '/'){
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello, World!\n');
    }
    
  }
  init() {
    this.server = http.createServer(this.handler.bind(this));
    this.server.on('error', (err) => {
        console.error(`[ERROR] Server error: ${err.message}`);
    });

    this.server.on('listening', () => {
        console.log(`[INFO] Server is listening on port ${this.port}`);
    });
  }

  start() {
    this.server.listen(this.port, () => {
        console.log(`[INFO] Server running at http://localhost:${this.port}/`);
    });
  }
}

export default Server;