import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Vite 的开发／构建配置；React 插件处理 JSX 与组件热更新，Tailwind 插件生成工具类样式。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 开发环境固定转发到本机 Go 后端；模型凭据与上游调用全部由后端管理。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
