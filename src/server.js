import express from 'express';
import fs from 'fs';
import path from 'path';

class Server {
  constructor(port, rundir, projects, manager) {
    this.port = port;
    this.projects = projects;
    this.manager = manager;
    this.rundir = rundir;
    this.app = express();
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      if (req.method === 'OPTIONS') {
        res.status(204).send('GET, POST, OPTIONS\n');
      } else {
        next();
      }
    });

    this.app.get('/project/:id', async (req, res) => {
      const projectId = req.params.id;
      try {
        const project = await this.projects.getProjectById(projectId);
        if (project) {
          res.status(200).json(project);
        } else {
          res.status(404).send('Project not found\n');
        }
      } catch (error) {
        console.error(`[ERROR] Error fetching project: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
      }
    });

    this.app.post('/create', async (req, res) => {
      console.log(`[INFO] Responding to create request: /create`);
      const projectData = req.body;
      try {
        if (!projectData.name || !projectData.body) {
          res.status(400).send('Project name and body are required\n');
          return;
        }
        await this.projects.createProject(projectData);
        console.log(`[INFO] Project created: ${projectData.name}`);
        res.status(200).send('Create project success\n');
      } catch (error) {
        console.error(`[ERROR] Error creating project: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
      }
    });

    this.app.get('/extensions/:id', (req, res) => {
      const extensionId = req.params.id;
      console.log(`[INFO] Responding to extension request: /extensions/${extensionId}`);
      if (!/^[\w]+$/.test(extensionId)) {
        res.status(400).send('Invalid extension id\n');
        return;
      }
      const extensionPath = `./extensions/${extensionId}.js`;
      try {
        res.status(200).send(
          fs.readFileSync(extensionPath, 'utf8')
        );
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error(`[ERROR] Extension not found: ${extensionId}`);
          res.status(404).send('Extension not found\n');
          return;
        }
        console.error(`[ERROR] Error loading extension: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
      }
    });
    this.app.get('/runner/add/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      console.log(`[INFO] Adding runner: ${runnerId}`);
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).send('Invalid runner id\n');
        return;
      }
      try {
        this.manager.addRunner(runnerId);
      } catch (error) {
        console.error(`[ERROR] Error adding runner: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
        return;
      }
      console.log(`[INFO] Runner ${runnerId} added successfully`);
      res.status(200).send(`Runner ${runnerId} added successfully\n`);
    });
    this.app.get('/runner/remove/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      console.log(`[INFO] Removing runner: ${runnerId}`);
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).send('Invalid runner id\n');
        return;
      }
      try {
        this.manager.removeRunner(runnerId);
      } catch (error) {
        console.error(`[ERROR] Error removing runner: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
        return;
      }
      res.status(200).send(`Runner ${runnerId} removed successfully\n`);
    });
    this.app.use((req, res) => {
      const requestedPath = req.path.replace(/^\/+/, '');
      let localPath = path.resolve(this.rundir, 'public', requestedPath);
      try {
        if (fs.statSync(localPath).isDirectory()) {
          localPath = path.join(localPath, 'index.html');
        }
        const fileContent = fs.readFileSync(localPath, 'utf8');
        res.status(200).send(fileContent);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error(`[ERROR] File not found: ${requestedPath}`);
          res.status(404).send('File not found\n');
          return;
        }
        console.error(`[ERROR] Error reading file: ${error.message}`);
        res.status(500).send('Internal Server Error\n');
      }
    });
  }

  init() {
    this.app.on('error', (err) => {
      console.error(`[ERROR] Server error: ${err.message}`);
    });
    this.app.on('listening', () => {
      console.log(`[INFO] Server is listening on port ${this.port}`);
    });
  }

  start(port) {
    this.app.listen((port?port:this.port), () => {
      console.log(`[INFO] Server running at http://localhost:${this.port}/`);
    });
  }
}

export default Server;