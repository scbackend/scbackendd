import Runner from "./runner.js";

class Manager {
    constructor() {
        this.runners = {};
    }
    addRunner(id) {
        if (!this.runners[id]) {
            this.runners[id] = new Runner(id);
            console.log(`[INFO] Runner added for ID: ${id}`);
            this.runners[id].init((vm) => {
                console.log(`[INFO] Runner initialized for ID: ${id}`);
            });
        } else {
            console.warn(`[WARN] Runner already exists for ID: ${id}`);
        }
    }
    triggerEvent(id, event, data) {
        if (this.runners[id]) {
            this.runners[id].trigger(event, data);
            console.log(`[INFO] Event triggered for ID: ${id}, Event: ${event}`, data);
        } else {
            console.error(`[ERROR] No runner found for ID: ${id}`);
        }
    }
}

export default Manager;