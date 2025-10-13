import fs from "fs";
import { listFiles } from "./utils/listfiles.js";
import { pathToFileURL } from "url";
import Config from "./config.js";

class Plugin {
    constructor(manager, service) {
        this.manager = manager;
        this.service = service;
        this.plugins = new Map();
        fs.mkdirSync('./plugins', { recursive: true });
        listFiles('./plugins').then(files => {
            files.forEach(file => {
                // 转为 file:// 绝对路径，兼容 ESModule 规范
                const fileUrl = pathToFileURL(file).href;
                import(fileUrl).then(module => {
                    const plugin = module;
                    this.addPlugin(file, plugin);
                }).catch(err => {
                    console.error(`[ERROR] Failed to load plugin from ${file}: ${err}`);
                });
            });
        }).catch(err => {
            console.error(`[ERROR] Failed to list plugin files: ${err}`);
        });
    }

    addPlugin(id, plugin) {
        if (typeof plugin.init === 'function') {
            try {
                const config = new Config(`./plugins/${plugin.name || 'unknown'}.yml`, 'yaml', plugin.defaultConfig || {});
                this.plugins.set(id, plugin);
                plugin.init(config, {
                    onRunerEvent: this.manager.addEventListener.bind(this.manager),
                    triggerRunnerEvent: this.manager.triggerRunnerEvent.bind(this.manager),
                    registerExtension: this.manager.registerExtension.bind(this.manager),
                    // 其他需要暴露给插件的接口
                });
                console.log(`[INFO] Plugin ${plugin.name || 'unknown'} initialized`);
            } catch (err) {
                console.error(`[ERROR] Failed to initialize plugin ${plugin.name || 'unknown'}: ${err}`);
            }
        } else {
            console.warn(`[WARN] Plugin ${plugin.name || 'unknown'} does not have an init function`);
        }
    }

    listPlugins() {
        return Array.from(this.plugins.values()).map(p => ({
            name: p.name || 'unknown',
            version: p.version || 'unknown'
        }));
    }

    removePlugin(plugin) {
        if (this.plugins.has(plugin)) {
            if (typeof this.plugins.get(plugin).destroy === 'function') {
                this.plugins.get(plugin).destroy();
            }
            this.plugins.delete(plugin);
            console.log(`[INFO] Plugin ${plugin} removed`);
        } else {
            console.warn(`[WARN] Plugin ${plugin} not found`);
        }
    }
}

export default Plugin;