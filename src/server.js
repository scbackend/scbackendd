import http from 'http';

class Server {
  constructor(port,projects) {
    this.port = port;
    this.projects = projects;
  }
  async handler(req, res) {
    const { method, url, headers } = req;
    console.log(`[INFO] Received request: ${method} ${url}`);
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
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!\n');
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