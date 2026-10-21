import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
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
