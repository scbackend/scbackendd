import Manager from './manager.js';
import Server from './server.js';
import process from 'process';

console.log('[INFO] Starting the backend server...');
const manager = new Manager();
const PORT = process.env.PORT || 3030;
const server = new Server(PORT);