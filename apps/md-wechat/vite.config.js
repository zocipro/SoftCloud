import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 相对路径构建：GitHub Pages 子路径与任意静态托管都能直接用
  base: './',
  plugins: [vue()],
})
