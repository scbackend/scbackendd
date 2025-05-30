import Runner from './runner.js';

console.log('[INFO] Starting the backend server...');
const runner = new Runner('test');
runner.init((vm) => {
    console.log('INFO - VM initialized and project loaded');
});