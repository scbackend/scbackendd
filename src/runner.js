import VirtualMachine from 'scbackend-vm';
import denque from 'denque';
import getProjectUrl from './getprojecturl.js';

class Runner {
    constructor(id) {
        this.vm = new VirtualMachine();
        this.id = id;
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
        fetch(getProjectUrl(this.id))
            .then(response => response.json())
            .then(project => {
                this.vm.loadProject(project['body'])
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