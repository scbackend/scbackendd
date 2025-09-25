import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from './logger.js';
import Config from './config.js';

class Server {
  constructor(port, rundir, projects, manager) {
    this.port = port;
    this.projects = projects;
    this.manager = manager;
    this.rundir = rundir;
    this.token = null;
    this.config = this.loadConfig();
    this.safepath = this.config.safepath || 'dashboard';

    this.app = express();
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      if (req.method === 'OPTIONS') {
        res.status(200).send('GET, POST, OPTIONS\n');
      } else {
        next();
      }
    });

    // 登录路由
    this.app.post('/login', (req, res) => {
      const { username, password } = req.body;
      if (
        username === this.config.username &&
        password === this.config.password
      ) {
        // 生成新 token
        this.token = crypto.randomBytes(32).toString('hex');
        res.status(200).json({ token: this.token });
      } else {
        res.status(401).json({ error: 'Invalid username or password' });
      }
    });

    this.app.use('/', express.static(path.resolve(this.rundir, 'public')));
    this.app.get('/favicon.ico', (req, res) => {
      res.sendFile(path.resolve(this.rundir, 'public', 'favicon.ico'));
    });
    this.app.use(new RegExp(`^\/static\/*$`), express.static(path.resolve(this.rundir, 'public')));

    this.app.use((req, res, next) => {
      if (req.path === '/login') return next();
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'Forbidden: Missing Bearer token' });
      }
      const token = authHeader.slice(7);
      if (token !== this.token) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
      }
      next();
    });

    this.app.get('/project/:id', async (req, res) => {
      const projectId = req.params.id;
      const filePath = path.resolve('.', 'projects', `${projectId}.sb3`);
      try {
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Project file not found' });
        return;
      }
      const fileBuffer = fs.readFileSync(filePath);
      res.setHeader('Content-Type', 'application/zip');
      res.status(200).send(fileBuffer);
      } catch (error) {
      console.error(`[ERROR] Error reading project file: ${error.message}`);
      res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.use('/project/:id', express.raw({ type: 'application/octet-stream', limit: '50mb' }));
    this.app.post('/project/:id', async (req, res) => {
      const projectId = req.params.id;
      const projectData = req.body;
      try {
        if (!projectData) {
          res.status(400).json({ error: 'Project body is required' });
          return;
        }
        const filePath = path.resolve('.', 'projects', `${projectId}.sb3`);
        const dirpath = path.dirname(filePath);
        if (!fs.existsSync(dirpath)) {
          fs.mkdirSync(dirpath, { recursive: true });
        }
        fs.writeFileSync(filePath, projectData, 'binary');
        console.log(`[INFO] Project updated: ${projectId}`);
        res.status(200).json({ message: 'Project updated successfully' });
      } catch (error) {
        console.error(`[ERROR] Error updating project: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/create', async (req, res) => {
      logger.log(`[INFO] Responding to create request: /create`);
      const projectData = req.body;
      try {
        if (!projectData.name || !projectData.body) {
          res.status(400).json({ error: 'Project name and body are required' });
          return;
        }
        await this.projects.createProject(projectData);
        logger.log(`[INFO] Project created: ${projectData.name}`);
        res.status(200).json({ message: 'Create project success' });
      } catch (error) {
        logger.error(`[ERROR] Error creating project: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    this.app.get('/runner/add/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      logger.log(`[INFO] Adding runner: ${runnerId}`);
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid runner id' });
        return;
      }
      try {
        this.manager.addRunner(runnerId);
      } catch (error) {
        logger.error(`[ERROR] Error adding runner: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      logger.log(`[INFO] Runner ${runnerId} added successfully`);
      res.status(200).json({ message: `Runner ${runnerId} added successfully` });
    });
    this.app.get('/runner/remove/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      logger.log(`[INFO] Removing runner: ${runnerId}`);
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid runner id' });
        return;
      }
      try {
        this.manager.removeRunner(runnerId);
      } catch (error) {
        logger.error(`[ERROR] Error removing runner: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      res.status(200).json({ message: `Runner ${runnerId} removed successfully` });
    });
    this.app.get('/projects', async (req, res) => {
      try {
        const projects = await this.projects.getAllProjects();
        res.status(200).json(projects);
      } catch (error) {
        logger.error(`[ERROR] Error fetching projects: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/runners', (req, res) => {
      try {
        const runnerIds = this.manager.runners ? Object.keys(this.manager.runners) : [];
        res.status(200).json(runnerIds);
      } catch (error) {
        logger.error(`[ERROR] Error fetching runners: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/project/delete/:id', async (req, res) => {
      const projectId = req.params.id;
      try {
        await this.projects.deleteProject(projectId);
        res.status(200).json({ message: 'Project deleted' });
      } catch (error) {
        logger.error(`[ERROR] Error deleting project: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/project/update/:id', async (req, res) => {
      const projectId = req.params.id;
      const { body } = req.body;
      try {
        await this.projects.updateProject({ name: projectId, body });
        res.status(200).json({ message: 'Project updated' });
      } catch (error) {
        logger.error(`[ERROR] Error updating project: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    
  }

  loadConfig() {
    return new Config( 'config.yml', 'yaml', {
      username: 'admin',
      password: 'admin',
    }).get();
  }
  init() {
    this.app.on('error', (err) => {
      logger.error(`[ERROR] Server error: ${err.message}`);
    });
    this.app.on('listening', () => {
      logger.log(`[INFO] Server is listening on port ${this.port}`);
    });
  }
  start(port) {
    this.app.listen((port?port:this.port), () => {
      logger.log(`[INFO] Server running at http://localhost:${this.port}/`);
    });
  }
}

export default Server;