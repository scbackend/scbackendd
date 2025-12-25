import Manager from './manager.js';
import Server from './server.js';
import process from 'process';
import Projects from './projects.js';
import Service from './service.js';
import logger, { Logger } from './logger.js';
import Config from './config.js';
import PluginManager from './plugin.js';
import Database from './database.js';
import DatabaseMigrations from './database-migrations.js';

// 生成安全的默认密码
const generateDefaultPassword = () => {
    // return crypto.randomBytes(16).toString('hex');
    return 'scbackend/******'
};

const main = (rundir) => {
    process.title = 'scbackendd';
    
    // 全局异常处理
    process.on('uncaughtException', (error) => {
        logger.fatal(`Uncaught Exception: ${error.stack}`, 'System');
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'System');
    });

    // 加载配置
    const configPath = './config.yml';
    const template = {
        username: process.env.SCBACKEND_USERNAME || "scbackend",
        password: process.env.SCBACKEND_PASSWORD || generateDefaultPassword(),
        dashport: parseInt(process.env.SCBACKEND_DASH_PORT) || 3030,
        serviceport: parseInt(process.env.SCBACKEND_SERVICE_PORT) || 3031,
        logging: {
            consoleLevel: process.env.SCBACKEND_LOG_CONSOLE_LEVEL || "info",      // 控制台输出级别: debug, info, warn, error, fatal
            fileLevel: process.env.SCBACKEND_LOG_FILE_LEVEL || "warn",         // 文件输出级别
            dbLevel: process.env.SCBACKEND_LOG_DB_LEVEL || "info",           // 数据库输出级别
            silentMode: process.env.SCBACKEND_SILENT_MODE === 'false',         // 静默模式
            logToConsole: process.env.SCBACKEND_LOG_TO_CONSOLE !== 'false',        // 是否输出到控制台
            logToFile: process.env.SCBACKEND_LOG_TO_FILE !== 'false',           // 是否输出到文件
            logToDatabase: process.env.SCBACKEND_LOG_TO_DB !== 'false',       // 是否输出到数据库
            runnerNetworkIO: process.env.SCBACKEND_LOG_RUNNER_NETWORK_IO === 'true'      // 是否记录Runner网络IO日志
        },
        database: {
            type: process.env.SCBACKEND_DB_TYPE || "sqlite",
            sqlite: {
                filename: process.env.SCBACKEND_SQLITE_FILENAME || "scbackend.db"
            },
            mysql: {
                host: process.env.SCBACKEND_MYSQL_HOST || "localhost",
                port: parseInt(process.env.SCBACKEND_MYSQL_PORT) || 3306,
                user: process.env.SCBACKEND_MYSQL_USER || "root",
                password: process.env.SCBACKEND_MYSQL_PASSWORD || "",
                database: process.env.SCBACKEND_MYSQL_DATABASE || "scbackend"
            }
        },
        plugins: {
            type: process.env.SCBACKEND_PLUGINS_DB_TYPE || "sqlite",
            sqlite: {
                filename: process.env.SCBACKEND_PLUGINS_SQLITE_FILENAME || "plugins.db"
            },
            mysql: {
                host: process.env.SCBACKEND_PLUGINS_MYSQL_HOST || "localhost",
                port: parseInt(process.env.SCBACKEND_PLUGINS_MYSQL_PORT) || 3306,
                user: process.env.SCBACKEND_PLUGINS_MYSQL_USER || "root",
                password: process.env.SCBACKEND_PLUGINS_MYSQL_PASSWORD || "",
                database: process.env.SCBACKEND_PLUGINS_MYSQL_DATABASE || "plugins"
            }
        }
    };

    const config = new Config(configPath, 'yaml', template);
    
    // 配置日志系统
    const loggingConfig = config.get('logging') || {};
    logger.setConfig(loggingConfig);
    
    logger.info('Starting the backend server...', 'System');

    // 创建项目数据库连接
    const projects = new Projects(config.get('database'));
    const manager = new Manager(projects);

    // 创建日志数据库连接
    let logDatabase = null;
    let dbMigrations = null;

    const initializeLoggingSystem = async () => {
        try {
            // 创建日志数据库连接（使用项目数据库配置）
            logDatabase = new Database(config.get('database'));
            
            // 初始化数据库迁移
            dbMigrations = new DatabaseMigrations(logDatabase);
            
            // 创建日志表
            await dbMigrations.createLogTables();
            
            // 设置logger的数据库连接
            logger.setDatabase(logDatabase, dbMigrations);
            
            logger.info('Logging system initialized with database support', 'System');
            
        } catch (error) {
            logger.warn(`Failed to initialize logging database: ${error.message}. Continuing with file logging only.`, 'System');
        }
    };

    // 连接项目数据库并初始化日志系统
    projects.connect()
        .then(async () => {
            logger.info('Project database connection established', 'System');
            
            // 初始化日志系统
            await initializeLoggingSystem();
            
            // 设置Runner选项
            const runnerOptions = {
                logNetworkIO: loggingConfig.runnerNetworkIO !== false,
                silentMode: loggingConfig.silentMode || false
            };
            
            // 更新manager的runner选项
            if (manager.setRunnerOptions) {
                manager.setRunnerOptions(runnerOptions);
            }
            
        })
        .catch(error => {
            logger.error(`Failed to connect to the database: ${error.message}`, 'System');
            process.exit(1);
        });

    // 获取端口配置
    const DASHPORT = config.get('dashport') || 3030;
    const SERVPORT = config.get('serviceport') || 3031;
    
    // 创建服务
    const service = new Service(SERVPORT, manager);
    const pluginManager = new PluginManager(manager, service, config.get('plugins'));
    const server = new Server(DASHPORT, rundir, projects, manager, config.get(), pluginManager);

    // 启动服务
    try {
        server.init();
        server.start();
        service.init();
        service.start();
    } catch (error) {
        logger.error(`Failed to start services: ${error.message}`, 'System');
        process.exit(1);
    }

    // 定期清理旧日志（每天一次）
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时
    const cleanupTimer = setInterval(async () => {
        try {
            await logger.cleanupOldLogs(30); // 保留30天日志
        } catch (error) {
            logger.error(`Failed to cleanup old logs: ${error.message}`, 'System');
        }
    }, cleanupInterval);

    // 优雅关闭
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down backend server...`, 'System');
        
        // 清除定时器
        clearInterval(cleanupTimer);
        
        try {
            // 清理插件
            if (pluginManager.cleanup) {
                pluginManager.cleanup();
            }
            
            // 刷新日志队列
            await logger.flush();
            
            // 关闭数据库连接
            if (logDatabase) {
                await logDatabase.close();
            }
            
            // 停止服务
            server.stop();
            service.stop();
            
            logger.info('Backend server shutdown completed', 'System');
            process.exit(0);
            
        } catch (error) {
            logger.error(`Error during shutdown: ${error.message}`, 'System');
            process.exit(1);
        }
    };

    // 注册关闭信号
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
};

export default main;