import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

class Config {
    constructor(filePath, type = 'json', template = {}) {
        this.filePath = filePath;
        this.type = type.toLowerCase();
        this.template = template;
        this.data = null;
        this._ensureFile();
        this._load();
    }

    _ensureFile() {
        if (!fs.existsSync(this.filePath)) {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this._save(this.template);
        }
    }

    _load() {
        const content = fs.readFileSync(this.filePath, 'utf8');
        if (this.type === 'yml' || this.type === 'yaml') {
            this.data = yaml.load(content) || {};
        } else if (this.type === 'json') {
            this.data = JSON.parse(content || '{}');
        } else {
            throw new Error('Unsupported config type');
        }
    }

    _save(data) {
        let content;
        if (this.type === 'yml' || this.type === 'yaml') {
            content = yaml.dump(data);
        } else if (this.type === 'json') {
            content = JSON.stringify(data, null, 2);
        } else {
            throw new Error('Unsupported config type');
        }
        fs.writeFileSync(this.filePath, content, 'utf8');
    }

    get(key) {
        return key ? this.data[key] : this.data;
    }

    set(key, value) {
        this.data[key] = value;
        this._save(this.data);
    }
}

export default Config;