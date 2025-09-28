import Manager from './manager.js';
import Server from './server.js';
import process from 'process';
import Projects from './projects.js';
import Service from './service.js';
import logger from './logger.js';
import Config from './config.js';

const main =(rundir) => {
    process.title = 'scbackendd';
    process.on('uncaughtException', (error) => {
        console.error(`[ERROR] Uncaught Exception: ${error}`);
        process.exit(1);
    });
    logger.log('[INFO] Starting the backend server...');
    const configPath = './config.yml';
    const template = {
        username: "scbackend",
        password: "scbackend/******",
        dashport: 3030,
        serviceport: 3031,
        database: {
            type: "sqlite",
            sqlite: {
            filename: "scbackend.db"
            },
            mysql: {
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "scbackend"
            }
        }
    };
    const config = new Config(configPath, 'yaml', template);
    const projects = new Projects(config.get('database'));
    const manager = new Manager(projects);

    projects.connect()
        .then(() => {
            logger.log('[INFO] Database connection established');
        })
        .catch(error => {
            logger.error(`[ERROR] Failed to connect to the database: ${error}`);
            process.exit(1);
        });

    const DASHPORT = process.env.DASHPORT || 3030;
    const SERVPORT = process.env.SERVPORT || 3031;
    const server = new Server(DASHPORT, rundir, projects, manager, config.get());
    const service = new Service(SERVPORT, manager);

    server.init();
    server.start();
    service.init();
    service.start();
};

export default main;

// if (process.argv[1] && process.argv[1].endsWith('index.js')) {
//     main();
// }