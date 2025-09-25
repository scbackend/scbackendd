import fs from 'fs/promises';

class Logger {
    log(message, level='info') {
        const timestamp = new Date().toISOString();
        const upperLevel = level.toUpperCase();
        console.log( `[${upperLevel}][${timestamp}] ${message}`);
        if (upperLevel === 'FATEL' || upperLevel === 'ERROR') {
            fs.mkdir('logs', { recursive: true }).catch(() => {});
            fs.writeFile('logs/server.log', '', { flag: 'wx' }).catch(() => {});
            fs.appendFile('logs/server.log', `[${upperLevel}][${timestamp}] ${message}\n`).catch(err => {
                console.error(`[${timestamp}] ERROR: Failed to write log`);
            });
        }
    }
    warn(message) {
        this.log(message, 'warn');
    }
    error(message) {
        this.log(message, 'error');
    }
    fatel(message) {
        this.log(message, 'fatel');
    }
    logForRunner(runnerId, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [Runner ${runnerId}] ${message}\n`;
        fs.appendFile(`logs/runner_${runnerId}.log`, logMessage).catch(err => {
            console.error(`[${timestamp}] ERROR: Failed to write log for runner ${runnerId}: ${err.message}`);
        });
    }
}

let logger = new Logger();
export default logger;