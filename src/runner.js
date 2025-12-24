import VirtualMachine from 'scbackend-vm';
import denque from 'denque';
import logger from './logger.js';

class Runner {
    constructor(id, project, regexts, options = {}) {
        try {
            this.vm = new VirtualMachine();
            this.id = id;
            this.project = project;
            this.options = {
                logNetworkIO: options.logNetworkIO !== false, // 是否记录网络IO日志
                logLevel: options.logLevel || 'info',         // 日志级别
                silentMode: options.silentMode || false       // 静默模式
            };

            // 设置VM配置
            this.vm.setTurboMode(true);
            this.vm.setCompatibilityMode(true);
            this.vm.setCompilerOptions({enabled: true, warpTimer: false, hotloop: true, register: true});
            
            this.eventqueue = new denque();
            this.exts = [
                'scbackendbasic',
            ];
            
            // 添加扩展
            for (const ext of regexts) {
                const extId = ext.getInfo().id;
                if (!this.exts.includes(extId)) this.exts.push(extId);
                this.vm.extensionManager.addBuiltinExtension(extId, ext);
            }
            
            this.status = 'initialized';
            this.lastError = null;
            
            // 记录初始化日志
            logger.info(`Runner ${id} initialized`, `Runner ${id}`);
            
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`Failed to initialize runner ${id}: ${this.lastError}`, `Runner ${id}`);
            throw error;
        }
    }

    async init(callback, handleEvent) {
        try {
            // 加载扩展
            for (const ext of this.exts) {
                if (typeof ext == 'string') this.vm.extensionManager.loadExtensionIdSync(ext);
            }

            // 获取项目数据
            const projectData = await this.project.getProjectBodyById(this.id);
            
            // 加载项目到VM
            await this.vm.loadProject(projectData);
            
            // 设置事件队列
            this.vm.runtime.scbackend = {};
            this.vm.runtime.scbackend.eventqueue = new denque();
            
            // 设置事件发送函数
            this.vm.runtime.scbackend.send = (event, data) => {
                this.eventqueue.push([event, data]);
                
                // 记录网络IO日志（输出事件）
                if (this.options.logNetworkIO) {
                    logger.logRunnerNetworkIO(this.id, event, 'out', data, null);
                }
                
                if (handleEvent) handleEvent(this.id);
            };

            // 启动VM
            this.vm.start();
            this.vm.greenFlag();
            
            this.status = 'running';
            this.lastError = null;
            
            logger.info(`Project loaded and VM started for runner: ${this.id}`, `Runner ${this.id}`);
            
            if (callback && typeof callback === 'function') {
                callback(this.vm);
            }
            
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`Error in init for runner ${this.id}: ${this.lastError}`, `Runner ${this.id}`);
            throw error;
        }
    }

    trigger(event, data, callback, field) {
        try {
            if (!this.vm) {
                this.status = 'error';
                this.lastError = 'VM is not initialized';
                logger.error('VM is not initialized', `Runner ${this.id}`);
                return;
            }

            // 记录网络IO日志（输入事件）
            if (this.options.logNetworkIO) {
                logger.logRunnerNetworkIO(this.id, event, 'in', data, null);
            }

            // 触发事件
            this.vm.runtime.startHatsWithParams(callback, data, field);
            
            logger.debug(`Triggered event: ${event} for runner: ${this.id}`, `Runner ${this.id}`);
            
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            logger.error(`Error triggering event for runner ${this.id}: ${this.lastError}`, `Runner ${this.id}`);
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
                
                logger.info(`VM stopped for runner: ${this.id}`, `Runner ${this.id}`);
            } else {
                this.status = 'not_initialized';
                logger.warn(`No VM to stop for runner: ${this.id}`, `Runner ${this.id}`);
            }
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message || String(error);
            delete this.vm;
            
            logger.warn(`Error stopping VM for runner: ${this.id}, error: ${this.lastError}`, `Runner ${this.id}`);
        }
    }

    // 获取运行状态
    getStatus() {
        return {
            id: this.id,
            status: this.status,
            lastError: this.lastError,
            eventQueueSize: this.eventqueue.length
        };
    }

    // 设置选项
    setOptions(options) {
        this.options = { ...this.options, ...options };
        
        // 更新日志静默模式
        if (options.silentMode !== undefined) {
            logger.setSilentMode(options.silentMode);
        }
    }
}

export default Runner;