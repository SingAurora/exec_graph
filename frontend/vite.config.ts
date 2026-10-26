import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Vite 的开发／构建配置；React 插件处理 JSX 与组件热更新，Tailwind 插件生成工具类样式。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 开发环境同源访问业务后端；模型凭据与上游调用全部由后端管理。
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:8081',
          changeOrigin: true,
        },
      },
    },
  }
})
