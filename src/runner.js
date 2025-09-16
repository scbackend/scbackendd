import VirtualMachine from 'scbackend-vm';
import denque from 'denque';

class Runner {
    constructor(id,project) {
        this.vm = new VirtualMachine();
        this.id = id;
        this.project = project;
        this.vm.setTurboMode(true);
        this.eventqueue = new denque();
        this.exts = [
            'event',
            'control',
            'operators',
            'variables',
            'myBlocks',
            'scbackendbasic',
        ];
    }
    init(callback, handleEvent) {
        // this.vm.extensionManager.loadExtensionIdSync('scbackendbasic');
        for (const ext of this.exts) {
            this.vm.extensionManager.loadExtensionIdSync(ext);
        }
        this.project.getProjectBodyById(this.id)
            .then(buffer => {
                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                return arrayBuffer;
            })
            .then(project => {
                this.vm.loadProject(project)
                    .then(() => {
                        this.vm.runtime.scbackend = {};
                        this.vm.runtime.scbackend.eventqueue = new denque();
                        this.vm.runtime.scbackend.send = (event, data) => {
                            this.eventqueue.push([event, data]);
                            if (handleEvent) handleEvent(this.id);
                        }
                        this.vm.start();
                        console.log('[INFO] Project loaded and VM started for runner:', this.id);
                        if (callback && typeof callback === 'function') {
                            callback(this.vm);
                        }
                    })
                    .catch(error => {
                        console.error('[ERROR] Error loading project:', error);
                    });
            })
            .catch(error => {
                console.error('[ERROR]Error fetching project:', error);
            });
    }
    close() {
        try {
            if (this.vm) {
            this.vm.stopAll();
            this.vm.clear();
            delete this.vm;
            console.log('[INFO] VM stopped for runner:', this.id);
            } else {
            console.warn('[WARN] No VM to stop for runner:', this.id);
            }
        } catch (e) {
            delete this.vm;
            console.warn('[WARN] Error stopping VM, deleted instance for runner:', this.id,);
        }
    }
    trigger(event, data, callback) {
        if (this.vm) {
            this.vm.runtime.scbackend.eventqueue.push([event, data]);
            this.vm.runtime.startHats(callback);
            console.log(`[INFO] Triggered event: ${event}`, data);
        } else {
            console.error('[ERROR] VM is not initialized');
        }
    }
};

export default Runner;