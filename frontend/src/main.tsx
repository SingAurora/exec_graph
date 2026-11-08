// React 启动入口：index.html 的模块脚本加载本文件；Vite 将 TSX 转换成浏览器可执行的 JavaScript。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { App } from './app/App'
import { TooltipProvider } from './shared/ui/tooltip/Tooltip'
import { ToastProvider } from './shared/ui/toast/Toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './app/providers/query-client'

/** 清理旧版 MSW 留下的 Service Worker，避免它继续拦截真实接口。 */
function removeLegacyMockWorker() {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
    registrations
      .filter((registration) => registration.active?.scriptURL.endsWith('/mockServiceWorker.js'))
      .map((registration) => registration.unregister()),
  )).catch(() => undefined)
}

/** 准备全局 Provider，再把业务应用挂载到 HTML 的 #root 容器。 */
function start() {
  removeLegacyMockWorker()
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

start()
