import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Vite 的开发／构建配置；React 插件处理 JSX 与组件热更新，Tailwind 插件生成工具类样式。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 这些代理只在 Vite 开发服务器生效；生产部署需另外配置 AI 请求转发。
      proxy: {
        '/platform-ai-api': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/platform-ai-api/, ''),
          headers: { Authorization: env.DEEPSEEK_API_KEY ? `Bearer ${env.DEEPSEEK_API_KEY}` : '' },
        },
        '/deepseek-api': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deepseek-api/, ''),
        },
        '/openai-api': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai-api/, ''),
        },
      },
    },
  }
})
