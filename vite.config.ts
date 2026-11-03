import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Tauri 开发时由 CLI 管理终端输出，避免清屏
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**', '**/.quizlab/**', '**/.leomath/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    rollupOptions: {
      input: {
        // 旧 HTML 试卷引擎入口保留
        main: resolve(rootDir, 'index.html'),
        // Tauri 桌面版独立入口
        app: resolve(rootDir, 'app.html'),
      },
    },
  },
})
