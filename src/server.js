import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from './logger.js';
import JSZip from 'jszip';

class Server {
  constructor(port, rundir, projects, manager, config, plugin) {
    this.port = port;
    this.projects = projects;
    this.manager = manager;
    this.rundir = rundir;
    this.token = null;
    this.config = config;
    this.plugin = plugin;

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
    this.app.use(new RegExp(`^\\/static\\/*$`), express.static(path.resolve(this.rundir, 'public')));
    this.app.get('/readme', _ => fs.readFileSync(path.resolve(this.rundir, 'README.md')));

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

    // 验证项目ID是否安全（防止路径遍历）
    const validateProjectId = (projectId) => {
      if (!projectId || typeof projectId !== 'string') return false;
      // 只允许字母、数字、下划线、连字符和点号
      return /^[\w\-\.]+$/.test(projectId) && !projectId.includes('..');
    };

    this.app.get('/project/:id', async (req, res) => {
      const projectId = req.params.id;
      
      // 验证项目ID
      if (!validateProjectId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const filePath = path.resolve('.', 'projects', `${projectId}.sb3`);
      
      // 额外的路径安全检查
      const normalizedPath = path.normalize(filePath);
      const projectsDir = path.resolve('.', 'projects');
      if (!normalizedPath.startsWith(projectsDir)) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      try {
        if (!fs.existsSync(filePath)) {
          res.status(404).json({ error: 'Project file not found' });
          return;
        }
        const fileBuffer = fs.readFileSync(filePath);
        res.setHeader('Content-Type', 'application/zip');
        res.status(200).send(fileBuffer);
      } catch (error) {
        logger.error(`Error reading project file: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.use('/project/:id', express.raw({ type: 'application/octet-stream', limit: '128mb' }));
    this.app.post('/project/:id', async (req, res) => {
      const projectId = req.params.id;
      const projectData = req.body;
      
      // 验证项目ID
      if (!validateProjectId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      try {
        if (!projectData) {
          res.status(400).json({ error: 'Project body is required' });
          return;
        }
        const filePath = path.resolve('.', 'projects', `${projectId}.json`);
        
        // 路径安全检查
        const normalizedPath = path.normalize(filePath);
        const projectsDir = path.resolve('.', 'projects');
        if (!normalizedPath.startsWith(projectsDir)) {
          res.status(400).json({ error: 'Invalid file path' });
          return;
        }

        const dirpath = path.dirname(filePath);
        if (!fs.existsSync(dirpath)) {
          fs.mkdirSync(dirpath, { recursive: true });
        }
        const zip = new JSZip();
        await zip.loadAsync(projectData);
        const projectJson = await zip.file('project.json').async('string');
        fs.writeFileSync(filePath, projectJson, 'binary');
        logger.info(`Project updated: ${projectId}`, 'Server');
        res.status(200).json({ message: 'Project updated successfully' });
      } catch (error) {
        logger.error(`Error updating project: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/create', async (req, res) => {
      logger.info(`Responding to create request: /create`, 'Server');
      const projectData = req.body;
      try {
        if (!projectData.name || !projectData.body) {
          res.status(400).json({ error: 'Project name and body are required' });
          return;
        }
        
        // 验证项目名称
        if (!validateProjectId(projectData.name)) {
          res.status(400).json({ error: 'Invalid project name' });
          return;
        }
        
        await this.projects.createProject(projectData);
        logger.info(`Project created: ${projectData.name}`, 'Server');
        res.status(200).json({ message: 'Create project success' });
      } catch (error) {
        logger.error(`Error creating project: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    
    this.app.get('/runner/add/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      logger.info(`Adding runner: ${runnerId}`, 'Server');
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid runner id' });
        return;
      }
      try {
        this.manager.addRunner(runnerId);
      } catch (error) {
        logger.error(`Error adding runner: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      logger.info(`Runner ${runnerId} added successfully`, 'Server');
      res.status(200).json({ message: `Runner ${runnerId} added successfully` });
    });
    
    this.app.get('/runner/remove/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      logger.info(`Removing runner: ${runnerId}`, 'Server');
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid runner id' });
        return;
      }
      try {
        this.manager.removeRunner(runnerId);
      } catch (error) {
        logger.error(`Error removing runner: ${error.message}`, 'Server');
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
        logger.error(`Error fetching projects: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/runners', (req, res) => {
      try {
        const runnerIds = this.manager.runners ? Object.keys(this.manager.runners) : [];
        res.status(200).json(runnerIds);
      } catch (error) {
        logger.error(`Error fetching runners: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/project/delete/:id', async (req, res) => {
      const projectId = req.params.id;
      
      // 验证项目ID
      if (!validateProjectId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }
      
      try {
        await this.projects.deleteProject(projectId);
        res.status(200).json({ message: 'Project deleted' });
      } catch (error) {
        logger.error(`Error deleting project: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/project/update/:id', async (req, res) => {
      const projectId = req.params.id;
      const { body } = req.body;
      
      // 验证项目ID
      if (!validateProjectId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }
      
      try {
        await this.projects.updateProject({ name: projectId, body });
        res.status(200).json({ message: 'Project updated' });
      } catch (error) {
        logger.error(`Error updating project: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/upload/:id', express.raw({ type: 'application/javascript', limit: '10mb' }), async (req, res) => {
      const pluginId = req.params.id;
      const pluginData = req.body;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      try {
        if (!pluginData) {
          res.status(400).json({ error: 'Plugin body is required' });
          return;
        }
        const filePath = path.resolve('.', 'plugins', `${pluginId}.js`);
        
        // 路径安全检查
        const normalizedPath = path.normalize(filePath);
        const pluginsDir = path.resolve('.', 'plugins');
        if (!normalizedPath.startsWith(pluginsDir)) {
          res.status(400).json({ error: 'Invalid file path' });
          return;
        }
        
        const dirpath = path.dirname(filePath);
        if (!fs.existsSync(dirpath)) {
          fs.mkdirSync(dirpath, { recursive: true });
        }
        fs.writeFileSync(filePath, pluginData, 'utf8');
        logger.info(`Plugin uploaded: ${pluginId}`, 'Server');
        res.status(200).json({ message: 'Plugin uploaded successfully' });
      } catch (error) {
        logger.error(`Error uploading plugin: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/plugins', (req, res) => {
      try {
        const plugins = this.plugin.listPlugins();
        res.status(200).json(plugins);
      } catch (error) {
        logger.error(`Error fetching plugins: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    
    this.app.get('/plugin/delete/:id', async (req, res) => {
      const pluginId = req.params.id;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      try {
        const pluginPath = path.resolve('.', 'plugins', `${pluginId}.js`);
        
        // 路径安全检查
        const normalizedPath = path.normalize(pluginPath);
        const pluginsDir = path.resolve('.', 'plugins');
        if (!normalizedPath.startsWith(pluginsDir)) {
          res.status(400).json({ error: 'Invalid file path' });
          return;
        }
        
        if (fs.existsSync(pluginPath)) {
          fs.unlinkSync(pluginPath);
          res.status(200).json({ message: 'Plugin file deleted' });
        } else {
          res.status(404).json({ error: 'Plugin file not found' });
        }
      } catch (error) {
        logger.error(`Error deleting plugin file: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/runner/status/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      logger.info(`Getting status for runner: ${runnerId}`, 'Server');
      try {
        const status = this.manager.getRunnerStatus(runnerId);
        res.status(200).json(status);
      } catch (error) {
        logger.error(`Error getting runner status: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/runners/status', (req, res) => {
      logger.info(`Getting status for all runners`, 'Server');
      try {
        const statuses = this.manager.getAllRunnersStatus();
        res.status(200).json(statuses);
      } catch (error) {
        logger.error(`Error getting all runners status: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // 插件管理路由
    this.app.get('/plugin/info/:id', (req, res) => {
      const pluginId = req.params.id;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      try {
        const info = this.plugin.getPluginInfo(pluginId);
        if (info) {
          res.status(200).json(info);
        } else {
          res.status(404).json({ error: 'Plugin not found' });
        }
      } catch (error) {
        logger.error(`Error getting plugin info: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/enable/:id', express.json(), (req, res) => {
      const pluginId = req.params.id;
      const { runners = [] } = req.body;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      // 验证runners数组
      if (!Array.isArray(runners)) {
        res.status(400).json({ error: 'Runners must be an array' });
        return;
      }
      
      try {
        this.plugin.enablePlugin(pluginId, runners);
        res.status(200).json({ message: 'Plugin enabled successfully' });
      } catch (error) {
        logger.error(`Error enabling plugin: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/disable/:id', (req, res) => {
      const pluginId = req.params.id;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      try {
        this.plugin.disablePlugin(pluginId);
        res.status(200).json({ message: 'Plugin disabled successfully' });
      } catch (error) {
        logger.error(`Error disabling plugin: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/reload/:id', (req, res) => {
      const pluginId = req.params.id;
      
      // 验证插件ID
      if (!validateProjectId(pluginId)) {
        res.status(400).json({ error: 'Invalid plugin ID' });
        return;
      }
      
      try {
        this.plugin.reloadPlugin(pluginId);
        res.status(200).json({ message: 'Plugin reloaded successfully' });
      } catch (error) {
        logger.error(`Error reloading plugin: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/enable-for-runner/:id/:runnerId', (req, res) => {
      const pluginId = req.params.id;
      const runnerId = req.params.runnerId;
      
      // 验证插件ID和runner ID
      if (!validateProjectId(pluginId) || !/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid plugin ID or runner ID' });
        return;
      }
      
      try {
        this.plugin.enableForRunner(pluginId, runnerId);
        res.status(200).json({ message: `Plugin ${pluginId} enabled for runner ${runnerId}` });
      } catch (error) {
        logger.error(`Error enabling plugin for runner: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.post('/plugin/disable-for-runner/:id/:runnerId', (req, res) => {
      const pluginId = req.params.id;
      const runnerId = req.params.runnerId;
      
      // 验证插件ID和runner ID
      if (!validateProjectId(pluginId) || !/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid plugin ID or runner ID' });
        return;
      }
      
      try {
        this.plugin.disableForRunner(pluginId, runnerId);
        res.status(200).json({ message: `Plugin ${pluginId} disabled for runner ${runnerId}` });
      } catch (error) {
        logger.error(`Error disabling plugin for runner: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/runner/plugins/:runnerId', (req, res) => {
      const runnerId = req.params.runnerId;
      
      // 验证runner ID
      if (!/^[\w-]+$/.test(runnerId)) {
        res.status(400).json({ error: 'Invalid runner ID' });
        return;
      }
      
      try {
        const plugins = this.plugin.getPluginsForRunner(runnerId);
        res.status(200).json(plugins);
      } catch (error) {
        logger.error(`Error getting plugins for runner: ${error.message}`, 'Server');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

  }

  init() {
    this.app.on('error', (err) => {
      logger.error(`Server error: ${err.message}`, 'Server');
    });
    this.app.on('listening', () => {
      logger.info(`Server is listening on port ${this.port}`, 'Server');
    });
  }
  
  start(port) {
    this.app.listen((port?this.port=port:this.port), () => {
      logger.info(`Server running at http://localhost:${this.port}/`, 'Server');
    });
  }
}

export default Server;