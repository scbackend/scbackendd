import Manager from './manager.js';
import Server from './server.js';
import process from 'process';
import Projects from './projects.js';
// import dbconfig from './dbconfig.js';
import fs from 'fs';

const main =() => {
    process.title = 'scbackendd';
    process.on('uncaughtException', (error) => {
        console.error('[ERROR] Uncaught Exception:', error);
        process.exit(1);
    });
    console.log('[INFO] Starting the backend server...');
    const dbconfigPath = './dbconfig.json';
    if (!fs.existsSync(dbconfigPath)) {
        //console.error('[ERROR] dbconfig.json not found. Please edit it with the required database configuration.');
        //create a default dbconfig.json
        const defaultDbConfig = `{
    "type": "sqlite","or": "mysql",
    "filename": "scbackend.db",
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "scbackend"
}`;
        fs.writeFileSync(dbconfigPath, defaultDbConfig, 'utf8');
        console.error('[INFO] A default dbconfig.json has been created. Please edit it with the required database configuration.');
        console.error('[INFO] Exiting the process.');
        process.exit(1);
    }
    let dbconfig = fs.existsSync(dbconfigPath) ? JSON.parse(fs.readFileSync(dbconfigPath, 'utf8')) : {};
    if (!dbconfig.type) {
        console.error('[ERROR] Database type not specified in dbconfig.json');
        process.exit(1);
    }
    const manager = new Manager();
    const projects = new Projects(dbconfig);

    projects.connect()
        .then(() => {
            console.log('[INFO] Database connection established');
        })
        .catch(error => {
            console.error('[ERROR] Failed to connect to the database:', error);
            process.exit(1);
        });

    const PORT = process.env.PORT || 3030;
    const server = new Server(PORT, projects);
    server.init();
    server.start();
};

export default main;

if(process.argv[1] === import.meta.url) {
    main();
}