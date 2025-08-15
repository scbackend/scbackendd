#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import main from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.resolve(__dirname, '..');

main(dir);
