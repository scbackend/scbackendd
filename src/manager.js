import Runner from "./runner.js";
import denque from 'denque';

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
            console.log(`[INFO] Runner added for ID: ${id}`);
            this.runners[id].init((vm) => {
                console.log(`[INFO] Runner initialized for ID: ${id}`);
            }, (runnerId) => this.handleEvent(runnerId));
        } else {
            console.warn(`[WARN] Runner already exists for ID: ${id}`);
        }
    }
    removeRunner(id) {
        if (this.runners[id]) {
            this.runners[id].close();
            delete this.runners[id];
            console.log(`[INFO] Runner removed for ID: ${id}`);
        } else {
            console.warn(`[WARN] No runner found for ID: ${id}`);
        }
    }
    triggerRunnerEvent(id, event, data) {
        if (this.runners[id]) {
            this.runners[id].trigger(event, data);
            console.log(`[INFO] Event triggered for ID: ${id}, Event: ${event}`, data);
        } else {
            console.error(`[ERROR] No runner found for ID: ${id}`);
        }
    }
    triggerLocalEvent(event, data) {
        if (this.eventbinding[event]) {
            for (const callback of this.eventbinding[event]) {
                if (typeof callback === 'function') {
                    callback(data);
                }
            }
            console.log(`[INFO] Local event triggered: ${event}`, data);
        } else {
            console.warn(`[WARN] No listeners for local event: ${event}`);
        }
    }
    addEventListener(event, callback) {
        if (!this.eventbinding[event]) {
            this.eventbinding[event] = [];
        }
        this.eventbinding[event].push(callback);
        console.log(`[INFO] Event listener added for event: ${event}`);
    }

    async handleEvent(id) {
        const runner = this.runners[id];
        if (!runner) {
            console.error(`[ERROR] No runner found for ID: ${id}`);
            return;
        }
        if (runner._handling) return;
        runner._handling = true;
        while (runner.eventqueue.length > 0) {
            const [event, data] = runner.eventqueue.shift();
            console.log(`[INFO] Handling event for ID: ${id}, Event: ${event}`, data);
            switch (event) {
                case 'message':
                    // 网络IO正常冒泡
                    console.log(`[INFO] Message for ID: ${id}`, data);
                    this.eventqueue.push([event, data]);
                    this.triggerLocalEvent('message');
                    break;
                // 可以添加更多事件处理
                default:
                    console.warn(`[WARN] Unknown event type: ${event} for ID: ${id}`);
            }
        }
        runner._handling = false;
    }
}

export default Manager;