import VirtualMachine from 'scbackend-vm';
import denque from 'denque';
import logger from './logger.js';

class Runner {
    constructor(id,project,regexts) {
        try {
            this.vm = new VirtualMachine();
            this.id = id;
            this.project = project;
            this.vm.setTurboMode(true);
            this.vm.setCompatibilityMode(true);
            this.vm.setCompilerOptions({enabled: true,warpTimer: false,hotloop: true,register: true});
            this.eventqueue = new denque();
            this.exts = [
                'scbackendbasic',
            ];
            for (const ext of regexts) {
                const id = ext.getInfo().id;
                if (!this.exts.includes(id)) this.exts.push(id);
                this.vm.extensionManager.addBuiltinExtension(id, ext);
            }
            this.status = 'initialized';
            this.lastError = null;
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`[ERROR] Failed to initialize runner ${id}: ${this.lastError}`);
            throw error;
        }
    }
    init(callback, handleEvent) {
        try {
            for (const ext of this.exts) {
                if (typeof ext == 'string') this.vm.extensionManager.loadExtensionIdSync(ext);
            }
            this.project.getProjectBodyById(this.id)
                .then(project => {
                    this.vm.loadProject(project)
                        .then(() => {
                            try {
                                this.vm.runtime.scbackend = {};
                                this.vm.runtime.scbackend.eventqueue = new denque();
                                this.vm.runtime.scbackend.send = (event, data) => {
                                    this.eventqueue.push([event, data]);
                                    if (handleEvent) handleEvent(this.id);
                                }
                                this.vm.start();
                                this.vm.greenFlag();
                                this.status = 'running';
                                this.lastError = null;
                                logger.log(`[INFO] Project loaded and VM started for runner: ${this.id}`);
                                if (callback && typeof callback === 'function') {
                                    callback(this.vm);
                                }
                            } catch (error) {
                                this.status = 'error';
                                this.lastError = error.message || String(error);
                                logger.error(`[ERROR] Error starting VM for runner ${this.id}: ${this.lastError}`);
                            }
                        })
                        .catch(error => {
                            this.status = 'error';
                            this.lastError = error.message || String(error);
                            logger.error(`[ERROR] Error loading project for runner ${this.id}: ${this.lastError}`);
                        });
                })
                .catch(error => {
                    this.status = 'error';
                    this.lastError = error.message || String(error);
                    logger.error(`[ERROR]Error fetching project for runner ${this.id}: ${this.lastError}`);
                });
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`[ERROR] Error in init for runner ${this.id}: ${this.lastError}`);
        }
    }
    close() {
        try {
            if (this.vm) {
                this.vm.stopAll();
                this.vm.clear();
                delete this.vm;
                this.status = 'stopped';
                this.lastError = null;
                logger.log(`[INFO] VM stopped for runner: ${this.id}`);
            } else {
                this.status = 'not_initialized';
                logger.warn(`[WARN] No VM to stop for runner: ${this.id}`);
            }
        } catch (e) {
            this.status = 'error';
            this.lastError = e.message || String(e);
            delete this.vm;
            logger.warn(`[WARN] Error stopping VM, deleted instance for runner: ${this.id}, error: ${this.lastError}`);
        }
    }
    trigger(event, data, callback, field) {
        try {
            if (this.vm) {
                this.vm.runtime.startHatsWithParams(callback, data, field);
                logger.log(`[INFO] Triggered event: ${event}: ${data} for runner: ${this.id}`);
            } else {
                this.status = 'error';
                this.lastError = 'VM is not initialized';
                logger.error('[ERROR] VM is not initialized');
            }
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`[ERROR] Error triggering event for runner ${this.id}: ${this.lastError}`);
        }
    }
};

export default Runner;