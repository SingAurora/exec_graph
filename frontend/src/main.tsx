// React 启动入口：index.html 的模块脚本加载本文件；Vite 将 TSX 转换成浏览器可执行的 JavaScript。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { App } from './app/App'
import { TooltipProvider } from './shared/ui/tooltip/Tooltip'
import { ToastProvider } from './shared/ui/toast/Toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './app/providers/query-client'

/** 准备开发模拟服务和全局 Provider，再把业务应用挂载到 HTML 的 #root 容器。 */
async function start() {
  // import.meta.env 由 Vite 提供。先等待 MSW 就绪，避免首次查询早于模拟接口启动。
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_MOCKS === 'true') {
    const { startMockAPI } = await import('./app/mocks/browser')
    await startMockAPI()
  }
  // 一个应用共享一份 Query 缓存；Provider 通过 React Context 把能力传给内部组件。
  const client = createQueryClient()
  // createRoot 接管容器，render 渲染组件树；“!”仅告诉 TypeScript 此元素非空。
  // StrictMode 在开发时额外检查渲染和 effect 清理，不代表生产环境重复执行业务操作。
  createRoot(document.getElementById('root')!).render(
    <StrictMode><QueryClientProvider client={client}>
      <TooltipProvider><ToastProvider><App /></ToastProvider></TooltipProvider>
    </QueryClientProvider></StrictMode>,
  )
}

// 此时 React 可能尚未挂载，启动失败直接写入 DOM；void 表示不再使用返回的 Promise。
void start().catch((error: unknown) => {
  const root = document.getElementById('root')!
  root.textContent = error instanceof Error ? `启动失败：${error.message}` : '启动失败，请刷新重试'
})
