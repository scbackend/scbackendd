import VirtualMachine from 'scratch-vm';
import getProjectUrl from './getprojecturl.js';

class Runner {
    constructor(id) {
        this.vm = new VirtualMachine();
        this.id = id;
    }
    init(callback) {
        fetch(getProjectUrl(this.id))
            .then(response => response.json())
            .then(project => {
                this.vm.loadProject(project)
                    .then(() => {
                        this.vm.start();
                        console.log('[INFO] Project loaded and VM started');
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
    trigger(event, data) {
        if (this.vm) {
            this.vm.runtime.startHat(event, data);
            console.log(`[INFO] Triggered event: ${event}`, data);
        } else {
            console.error('[ERROR] VM is not initialized');
        }
    }
};

export default Runner;