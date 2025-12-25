import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

class Config {
    constructor(filePath, type = 'json', template = {}) {
        this.filePath = path.resolve(filePath);
        this.type = type.toLowerCase();
        this.template = template;
        this.data = null;
        this._ensureFile();
        this._load();
    }

    _ensureFile() {
        try {
            if (!fs.existsSync(this.filePath)) {
                const dir = path.dirname(this.filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
                }
                this._save(this.template);
            }
        } catch (error) {
            throw new Error(`Failed to create config file: ${error.message}`);
        }
    }

    _load() {
        try {
            const content = fs.readFileSync(this.filePath, 'utf8');
            if (this.type === 'yml' || this.type === 'yaml') {
                this.data = yaml.load(content) || {};
            } else if (this.type === 'json') {
                this.data = JSON.parse(content || '{}');
            } else {
                throw new Error('Unsupported config type');
            }
            
            // 合并模板中的默认值
            this.data = this._mergeWithTemplate(this.data, this.template);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid ${this.type} syntax in config file: ${error.message}`);
            } else {
                throw new Error(`Failed to load config: ${error.message}`);
            }
        }
    }

    _mergeWithTemplate(current, template) {
        const result = { ...current };
        
        for (const key in template) {
            if (template.hasOwnProperty(key)) {
                if (typeof template[key] === 'object' && template[key] !== null && !Array.isArray(template[key])) {
                    // 递归合并嵌套对象
                    result[key] = this._mergeWithTemplate(result[key] || {}, template[key]);
                } else if (!(key in result)) {
                    // 如果键不存在于当前配置中，使用模板值
                    result[key] = template[key];
                }
            }
        }
        
        return result;
    }

    _save(data) {
        try {
            let content;
            if (this.type === 'yml' || this.type === 'yaml') {
                content = yaml.dump(data, { lineWidth: -1 }); // 禁用行宽度限制
            } else if (this.type === 'json') {
                content = JSON.stringify(data, null, 2);
            } else {
                throw new Error('Unsupported config type');
            }
            
            // 确保目录存在
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
            }
            
            // 写入文件
            fs.writeFileSync(this.filePath, content, 'utf8');
            
            // 设置适当的文件权限（仅限非Windows系统）
            if (process.platform !== 'win32') {
                fs.chmodSync(this.filePath, 0o600); // 只有所有者可读写
            }
        } catch (error) {
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    get(key) {
        if (!key) {
            return this.data;
        }
        
        // 支持点符号访问嵌套属性
        const keys = key.split('.');
        let value = this.data;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(key, value) {
        if (!key) {
            throw new Error('Key is required');
        }
        
        // 支持点符号设置嵌套属性
        const keys = key.split('.');
        let target = this.data;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in target) || typeof target[k] !== 'object' || target[k] === null) {
                target[k] = {};
            }
            target = target[k];
        }
        
        const lastKey = keys[keys.length - 1];
        target[lastKey] = value;
        
        this._save(this.data);
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    delete(key) {
        if (!key) {
            throw new Error('Key is required');
        }
        
        const keys = key.split('.');
        let target = this.data;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in target) || typeof target[k] !== 'object') {
                return false; // 键不存在
            }
            target = target[k];
        }
        
        const lastKey = keys[keys.length - 1];
        if (lastKey in target) {
            delete target[lastKey];
            this._save(this.data);
            return true;
        }
        
        return false;
    }

    reload() {
        this._load();
    }
}

export default Config;