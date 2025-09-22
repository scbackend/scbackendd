// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/scbackendd.js'],
  format: ['cjs'], // 或 ['cjs']，根据你的目标
  target: 'node20',
  outDir: 'dist',
  minify: true,
  sourcemap: true,
  clean: true,
  dts: true, // 如果你需要类型声明
})
