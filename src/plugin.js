import fs from "fs";
import path from "path";
import { listFiles } from "./utils/listfiles.js";
import { pathToFileURL } from "url";
import Config from "./config.js";
import logger from "./logger.js";

class PluginManager {
    constructor(manager, service, pluginsConfig = {}) {
        this.manager = manager;
        this.service = service;
        this.plugins = new Map(); // id -> plugin object
        this.pluginStates = new Map(); // id -> { enabled: boolean, runners: string[] }
        this.pluginConfigs = new Map(); // id -> Config instance
        this.pluginDir = './rundir/plugins';
        this.pluginsDbPath = pluginsConfig.sqlite?.filename || './rundir/plugins.db';
        
        // 确保插件目录存在
        fs.mkdirSync(this.pluginDir, { recursive: true });
        
        // 加载插件状态数据库
        this.loadPluginStates();
        
        // 扫描并加载插件
        this.scanAndLoadPlugins();
    }

    // 加载插件状态数据库
    loadPluginStates() {
        try {
            if (fs.existsSync(this.pluginsDbPath)) {
                const data = JSON.parse(fs.readFileSync(this.pluginsDbPath, 'utf8'));
                for (const [id, state] of Object.entries(data)) {
                    this.pluginStates.set(id, state);
                }
                logger.info(`Loaded plugin states from ${this.pluginsDbPath}`, 'PluginManager');
            }
        } catch (err) {
            logger.warn(`Failed to load plugin states: ${err.message}`, 'PluginManager');
        }
    }

    // 保存插件状态
    savePluginStates() {
        try {
            const states = {};
            for (const [id, state] of this.pluginStates) {
                states[id] = state;
            }
            fs.writeFileSync(this.pluginsDbPath, JSON.stringify(states, null, 2));
        } catch (err) {
            logger.error(`Failed to save plugin states: ${err.message}`, 'PluginManager');
        }
    }

    // 扫描并加载插件
    async scanAndLoadPlugins() {
        try {
            const files = await listFiles(this.pluginDir);
            
            for (const file of files) {
                // 跳过非JS文件和已禁用的文件
                if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
                if (file.includes('.disabled')) continue;
                
                const pluginId = path.basename(file, path.extname(file));
                
                // 检查插件是否应该启用
                const pluginState = this.pluginStates.get(pluginId) || { 
                    enabled: true, 
                    runners: [] // 空数组表示所有runner
                };
                
                if (pluginState.enabled) {
                    await this.loadPlugin(file, pluginId);
                }
            }
            
            logger.info(`Plugin scan completed. Total plugins: ${this.plugins.size}`, 'PluginManager');
            
        } catch (err) {
            logger.error(`Failed to scan plugin files: ${err.message}`, 'PluginManager');
        }
    }

    // 加载单个插件
    async loadPlugin(filePath, pluginId) {
        try {
            const fileUrl = pathToFileURL(filePath).href;
            const module = await import(fileUrl);
            
            if (!module.name) {
                logger.warn(`Plugin ${pluginId} missing name property`, 'PluginManager');
                return;
            }
            
            // 加载插件配置
            const configPath = path.join(this.pluginDir, `${pluginId}.yml`);
            const config = new Config(configPath, 'yaml', module.defaultConfig || {});
            this.pluginConfigs.set(pluginId, config);
            
            // 初始化插件
            if (typeof module.init === 'function') {
                const api = this.createPluginAPI(pluginId, module);
                
                try {
                    module.init(config.get(), api);
                    this.plugins.set(pluginId, module);
                    
                    logger.info(`Plugin ${module.name} (${pluginId}) initialized`, 'PluginManager');
                } catch (err) {
                    logger.error(`Failed to initialize plugin ${module.name}: ${err.message}`, 'PluginManager');
                }
            } else {
                logger.warn(`Plugin ${module.name} does not have an init function`, 'PluginManager');
            }
            
        } catch (err) {
            logger.error(`Failed to load plugin from ${filePath}: ${err.message}`, 'PluginManager');
        }
    }

    // 创建插件API
    createPluginAPI(pluginId, pluginModule) {
        return {
            // 基础信息
            pluginId,
            pluginName: pluginModule.name,
            pluginVersion: pluginModule.version || '1.0.0',
            
            // 配置管理
            getConfig: () => {
                const config = this.pluginConfigs.get(pluginId);
                return config ? config.get() : {};
            },
            
            setConfig: (key, value) => {
                const config = this.pluginConfigs.get(pluginId);
                if (config) {
                    config.set(key, value);
                    config.save();
                }
            },
            
            // 事件系统
            onRunnerEvent: (event, callback) => {
                this.manager.addEventListener(event, (runnerId, ...args) => {
                    // 检查插件是否应用于此runner
                    const state = this.pluginStates.get(pluginId);
                    if (state && state.runners.length > 0 && !state.runners.includes(runnerId)) {
                        return; // 插件不应用于此runner
                    }
                    callback(runnerId, ...args);
                });
            },
            
            triggerRunnerEvent: (runnerId, event, data, callback, field) => {
                this.manager.triggerRunnerEvent(runnerId, event, data, callback, field);
            },
            
            // 扩展注册
            registerExtension: (extension) => {
                this.manager.registerExtension(extension);
            },
            
            // Runner管理
            getRunner: (runnerId) => {
                return this.manager.runners[runnerId];
            },
            
            getAllRunners: () => {
                return { ...this.manager.runners };
            },
            
            getRunnerStatus: (runnerId) => {
                return this.manager.getRunnerStatus(runnerId);
            },
            
            getAllRunnersStatus: () => {
                return this.manager.getAllRunnersStatus();
            },
            
            // 日志
            log: (level, message, context = 'Plugin') => {
                const fullContext = `${pluginModule.name}${context ? `/${context}` : ''}`;
                logger[level](message, fullContext);
            },
            
            // 服务API
            sendToSession: (sessionId, message) => {
                const ws = this.service.mappings?.get(sessionId);
                if (ws) {
                    try {
                        ws.send(JSON.stringify({ type: 'message', message }));
                    } catch (err) {
                        logger.error(`Failed to send message to session ${sessionId}: ${err.message}`, 'PluginManager');
                    }
                }
            },
            
            kickSession: (sessionId, reason = 'Kicked by plugin') => {
                const ws = this.service.mappings?.get(sessionId);
                if (ws) {
                    try {
                        ws.send(JSON.stringify({ type: 'kick', reason }));
                        ws.close(1000, reason);
                        this.service.mappings?.delete(sessionId);
                    } catch (err) {
                        logger.error(`Failed to kick session ${sessionId}: ${err.message}`, 'PluginManager');
                    }
                }
            },
            
            // 插件状态管理
            isEnabledForRunner: (runnerId) => {
                const state = this.pluginStates.get(pluginId);
                if (!state || !state.enabled) return false;
                if (state.runners.length === 0) return true; // 应用于所有runner
                return state.runners.includes(runnerId);
            }
        };
    }

    // 启用插件
    enablePlugin(pluginId, runners = []) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            // 尝试从文件加载
            const pluginPath = path.join(this.pluginDir, `${pluginId}.js`);
            if (fs.existsSync(pluginPath)) {
                this.loadPlugin(pluginPath, pluginId);
            } else {
                throw new Error(`Plugin ${pluginId} not found`);
            }
        }
        
        const state = this.pluginStates.get(pluginId) || { enabled: false, runners: [] };
        state.enabled = true;
        state.runners = runners; // 空数组表示所有runner
        this.pluginStates.set(pluginId, state);
        this.savePluginStates();
        
        logger.info(`Plugin ${pluginId} enabled for runners: ${runners.length === 0 ? 'all' : runners.join(', ')}`, 'PluginManager');
        return true;
    }

    // 禁用插件
    disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        const state = this.pluginStates.get(pluginId) || { enabled: true, runners: [] };
        state.enabled = false;
        this.pluginStates.set(pluginId, state);
        this.savePluginStates();
        
        // 调用插件的destroy函数
        if (typeof plugin.destroy === 'function') {
            try {
                plugin.destroy();
            } catch (err) {
                logger.error(`Error destroying plugin ${pluginId}: ${err.message}`, 'PluginManager');
            }
        }
        
        this.plugins.delete(pluginId);
        logger.info(`Plugin ${pluginId} disabled`, 'PluginManager');
        return true;
    }

    // 为特定runner启用插件
    enableForRunner(pluginId, runnerId) {
        const state = this.pluginStates.get(pluginId);
        if (!state) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        if (!state.enabled) {
            state.enabled = true;
        }
        
        if (!state.runners.includes(runnerId)) {
            state.runners.push(runnerId);
            this.pluginStates.set(pluginId, state);
            this.savePluginStates();
            
            logger.info(`Plugin ${pluginId} enabled for runner ${runnerId}`, 'PluginManager');
        }
        
        return true;
    }

    // 为特定runner禁用插件
    disableForRunner(pluginId, runnerId) {
        const state = this.pluginStates.get(pluginId);
        if (!state) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        const index = state.runners.indexOf(runnerId);
        if (index !== -1) {
            state.runners.splice(index, 1);
            this.pluginStates.set(pluginId, state);
            this.savePluginStates();
            
            logger.info(`Plugin ${pluginId} disabled for runner ${runnerId}`, 'PluginManager');
        }
        
        return true;
    }

    // 获取插件列表
    listPlugins() {
        const result = [];
        
        for (const [id, plugin] of this.plugins) {
            const state = this.pluginStates.get(id) || { enabled: true, runners: [] };
            result.push({
                id,
                name: plugin.name || 'unknown',
                version: plugin.version || 'unknown',
                enabled: state.enabled,
                runners: state.runners,
                description: plugin.description || ''
            });
        }
        
        return result;
    }

    // 获取插件详情
    getPluginInfo(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return null;
        
        const state = this.pluginStates.get(pluginId) || { enabled: true, runners: [] };
        const config = this.pluginConfigs.get(pluginId);
        
        return {
            id: pluginId,
            name: plugin.name || 'unknown',
            version: plugin.version || 'unknown',
            enabled: state.enabled,
            runners: state.runners,
            description: plugin.description || '',
            config: config ? config.get() : {},
            hasDestroy: typeof plugin.destroy === 'function'
        };
    }

    // 重新加载插件
    async reloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        // 调用destroy函数
        if (typeof plugin.destroy === 'function') {
            try {
                plugin.destroy();
            } catch (err) {
                logger.warn(`Error destroying plugin ${pluginId} during reload: ${err.message}`, 'PluginManager');
            }
        }
        
        // 从插件列表中移除
        this.plugins.delete(pluginId);
        
        // 重新加载
        const pluginPath = path.join(this.pluginDir, `${pluginId}.js`);
        if (fs.existsSync(pluginPath)) {
            await this.loadPlugin(pluginPath, pluginId);
            logger.info(`Plugin ${pluginId} reloaded`, 'PluginManager');
            return true;
        }
        
        return false;
    }

    // 获取应用于特定runner的插件
    getPluginsForRunner(runnerId) {
        const plugins = [];
        
        for (const [id, plugin] of this.plugins) {
            const state = this.pluginStates.get(id);
            if (state && state.enabled) {
                if (state.runners.length === 0 || state.runners.includes(runnerId)) {
                    plugins.push({
                        id,
                        name: plugin.name,
                        version: plugin.version
                    });
                }
            }
        }
        
        return plugins;
    }

    // 清理插件
    cleanup() {
        for (const [id, plugin] of this.plugins) {
            if (typeof plugin.destroy === 'function') {
                try {
                    plugin.destroy();
                } catch (err) {
                    logger.error(`Error destroying plugin ${id}: ${err.message}`, 'PluginManager');
                }
            }
        }
        
        this.plugins.clear();
        logger.info('All plugins cleaned up', 'PluginManager');
    }
}

export default PluginManager;