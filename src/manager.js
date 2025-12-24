import Runner from "./runner.js";
import denque from 'denque';
import logger from './logger.js';

class Manager {
    constructor(project) {
        this.runners = {};
        this.project = project;
        this.eventqueue = new denque();
        this._handling = false;
        this.eventbinding = {};
        this.registeredExts = [];
        this.runnerOptions = {
            logNetworkIO: true,
            silentMode: false
        };
    }

    // 设置Runner选项
    setRunnerOptions(options) {
        this.runnerOptions = { ...this.runnerOptions, ...options };
        
        // 更新现有Runner的选项
        for (const id in this.runners) {
            if (this.runners[id].setOptions) {
                this.runners[id].setOptions(this.runnerOptions);
            }
        }
        
        logger.info(`Runner options updated: ${JSON.stringify(this.runnerOptions)}`, 'Manager');
    }

    registerExtension(ext) {
        if (!this.registeredExts.includes(ext)) {
            this.registeredExts.push(ext);
            logger.debug(`Extension registered: ${ext.getInfo().id}`, 'Manager');
        }
    }

    addRunner(id) {
        if (!this.runners[id]) {
            try {
                this.runners[id] = new Runner(id, this.project, this.registeredExts, this.runnerOptions);
                this.runners[id]._handling = false;
                
                logger.info(`Runner added for ID: ${id}`, 'Manager');
                
                this.runners[id].init((vm) => {
                    logger.info(`Runner initialized for ID: ${id}`, `Runner ${id}`);
                }, (runnerId) => this.handleEvent(runnerId));
                
            } catch (error) {
                logger.error(`Failed to add runner ${id}: ${error.message}`, 'Manager');
                throw error;
            }
        } else {
            logger.warn(`Runner already exists for ID: ${id}`, 'Manager');
        }
    }

    removeRunner(id) {
        if (this.runners[id]) {
            try {
                this.runners[id].close();
                delete this.runners[id];
                logger.info(`Runner removed for ID: ${id}`, 'Manager');
            } catch (error) {
                logger.error(`Error removing runner ${id}: ${error.message}`, 'Manager');
            }
        } else {
            logger.warn(`No runner found for ID: ${id}`, 'Manager');
        }
    }

    triggerRunnerEvent(id, event, data, callback, field) {
        if (this.runners[id]) {
            try {
                this.runners[id].trigger(event, data, callback, field);
                logger.debug(`Event triggered for ID: ${id}, Event: ${event}`, `Runner ${id}`);
            } catch (error) {
                logger.error(`Error triggering event for runner ${id}: ${error.message}`, `Runner ${id}`);
            }
        } else {
            logger.error(`No runner found for ID: ${id}`, 'Manager');
        }
    }

    triggerLocalEvent(event, data) {
        if (this.eventbinding[event]) {
            for (const callback of this.eventbinding[event]) {
                if (typeof callback === 'function') {
                    try {
                        callback(...data);
                    } catch (error) {
                        logger.error(`Error in local event callback for ${event}: ${error.message}`, 'Manager');
                    }
                }
            }
            logger.debug(`Local event triggered: ${event}`, 'Manager');
        } else {
            logger.debug(`No listeners for local event: ${event}`, 'Manager');
        }
    }

    addEventListener(event, callback) {
        if (!this.eventbinding[event]) {
            this.eventbinding[event] = [];
        }
        this.eventbinding[event].push(callback);
        logger.debug(`Event listener added for event: ${event}`, 'Manager');
    }

    getRunnerStatus(id) {
        if (this.runners[id]) {
            const status = this.runners[id].getStatus ? 
                this.runners[id].getStatus() : 
                {
                    id: id,
                    status: this.runners[id].status || 'unknown',
                    lastError: this.runners[id].lastError || null
                };
            
            return status;
        } else {
            return {
                id: id,
                status: 'not_found',
                lastError: 'Runner not found',
                hasVm: false
            };
        }
    }

    getAllRunnersStatus() {
        const statuses = {};
        for (const id in this.runners) {
            statuses[id] = this.getRunnerStatus(id);
        }
        return statuses;
    }

    async handleEvent(id) {
        const runner = this.runners[id];
        if (!runner) {
            logger.error(`No runner found for ID: ${id}`, 'Manager');
            return;
        }
        
        if (runner._handling) return;
        runner._handling = true;
        
        try {
            while (runner.eventqueue.length > 0) {
                const [event, data] = runner.eventqueue.shift();
                
                logger.debug(`Handling event for ID: ${id}, Event: ${event}`, `Runner ${id}`);
                
                this.triggerLocalEvent('event', [id, event, data]);
                
                switch (event) {
                    case 'message':
                        logger.debug(`Message from runner ${id} to session ${data.dst}`, `Runner ${id}`);
                        this.eventqueue.push([event, data]);
                        this.triggerLocalEvent('message', [id]);
                        break;
                        
                    case 'log':
                        const logmsg = data.body;
                        logger.info(`Runner log: ${logmsg}`, `Runner ${id}`);
                        break;
                        
                    case 'kick':
                        const dst = data.dst;
                        const reason = data.reason || 'Kicked by server';
                        this.eventqueue.push([event, {dst, reason}]);
                        this.triggerLocalEvent('message', [id]);
                        logger.info(`Kick event for session ${dst}: ${reason}`, `Runner ${id}`);
                        break;
                        
                    default:
                        logger.warn(`Unknown event type: ${event} for ID: ${id}`, `Runner ${id}`);
                }
            }
        } catch (error) {
            logger.error(`Error handling events for runner ${id}: ${error.message}`, `Runner ${id}`);
        } finally {
            runner._handling = false;
        }
    }

    // 获取所有Runner的统计信息
    getRunnerStats() {
        const stats = {
            total: Object.keys(this.runners).length,
            byStatus: {},
            withErrors: 0
        };

        for (const id in this.runners) {
            const runner = this.runners[id];
            const status = runner.status || 'unknown';
            
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            if (runner.lastError) {
                stats.withErrors++;
            }
        }

        return stats;
    }
}

export default Manager;