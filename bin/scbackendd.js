#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import main from '../src/index.js';

const dir = path.resolve(__dirname, '..');

main(dir);
