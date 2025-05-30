import http from 'http';

class Server {
  constructor(port) {
    this.port = port;
  }
  handler(req, res) {
    const { method, url, headers } = req;
    console.log(`[INFO] Received request: ${method} ${url}`);
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
        console.log(`Server running at http://localhost:${this.port}/`);
    });
  }
}

export default Server;