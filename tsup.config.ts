// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/scbackendd.js'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  minify: true,
  clean: true,
})
