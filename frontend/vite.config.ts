import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'graph-vendor': ['cytoscape'],
          'editor-vendor': [
            '@uiw/react-codemirror',
            '@codemirror/lang-html',
            '@codemirror/state',
            '@codemirror/theme-one-dark',
            '@codemirror/view',
          ],
        },
      },
    },
  },
})
