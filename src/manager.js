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
    }
    addRunner(id) {
        if (!this.runners[id]) {
            this.runners[id] = new Runner(id, this.project);
            this.runners[id]._handling = false;
            logger.log(`[INFO] Runner added for ID: ${id}`);
            this.runners[id].init((vm) => {
                logger.log(`[INFO] Runner initialized for ID: ${id}`);
            }, (runnerId) => this.handleEvent(runnerId));
        } else {
            logger.warn(`[WARN] Runner already exists for ID: ${id}`);
        }
    }
    removeRunner(id) {
        if (this.runners[id]) {
            this.runners[id].close();
            delete this.runners[id];
            logger.log(`[INFO] Runner removed for ID: ${id}`);
        } else {
            logger.warn(`[WARN] No runner found for ID: ${id}`);
        }
    }
    triggerRunnerEvent(id, event, data) {
        if (this.runners[id]) {
            this.runners[id].trigger(event, data);
            logger.log(`[INFO] Event triggered for ID: ${id}, Event: ${event}`, data);
        } else {
            logger.error(`[ERROR] No runner found for ID: ${id}`);
        }
    }
    triggerLocalEvent(event, data) {
        if (this.eventbinding[event]) {
            for (const callback of this.eventbinding[event]) {
                if (typeof callback === 'function') {
                    callback(...data);
                }
            }
            logger.log(`[INFO] Local event triggered: ${event}`, data);
        } else {
            logger.warn(`[WARN] No listeners for local event: ${event}`);
        }
    }
    addEventListener(event, callback) {
        if (!this.eventbinding[event]) {
            this.eventbinding[event] = [];
        }
        this.eventbinding[event].push(callback);
        logger.log(`[INFO] Event listener added for event: ${event}`);
    }

    async handleEvent(id) {
        const runner = this.runners[id];
        if (!runner) {
            logger.error(`[ERROR] No runner found for ID: ${id}`);
            return;
        }
        if (runner._handling) return;
        runner._handling = true;
        while (runner.eventqueue.length > 0) {
            const [event, data] = runner.eventqueue.shift();
            logger.log(`[INFO] Handling event for ID: ${id}, Event: ${event}`, data);
            switch (event) {
                case 'message':
                    logger.log(`[INFO] Message for ID: ${id}`, data);
                    this.eventqueue.push([event, data]);
                    this.triggerLocalEvent('message',[id]);
                    break;
                // 可以添加更多事件处理
                default:
                    logger.warn(`[WARN] Unknown event type: ${event} for ID: ${id}`);
            }
        }
        runner._handling = false;
    }
}

export default Manager;