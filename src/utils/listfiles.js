import { readdir } from 'fs/promises';
import { join } from 'path';

export async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => join(dir, entry.name));

  return files;
}