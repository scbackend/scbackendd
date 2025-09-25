#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import main from '../src/index.js';

const dir = () => {
    try {
        return path.resolve(__dirname, '..');
    } catch {
        return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    }
}

main(dir());
