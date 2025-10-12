
import { listFiles } from "./utils/listfiles.js";
import { pathToFileURL } from "url";

class Plugin {
    constructor(manager, service) {
        this.manager = manager;
        this.service = service;
        this.plugins = new Map();
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
            this.plugins.set(id, plugin);
            plugin.init(this.manager, this.service);
            console.log(`[INFO] Plugin ${plugin.name || 'unknown'} initialized`);
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