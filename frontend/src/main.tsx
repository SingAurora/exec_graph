import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { App } from './app/App'
import { TooltipProvider } from './shared/ui/tooltip/Tooltip'
import { ToastProvider } from './shared/ui/toast/Toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './app/providers/query-client'

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_MOCKS === 'true') {
    const { startMockAPI } = await import('./app/mocks/browser')
    await startMockAPI()
  }
  const client = createQueryClient()
  createRoot(document.getElementById('root')!).render(
    <StrictMode><QueryClientProvider client={client}>
      <TooltipProvider><ToastProvider><App /></ToastProvider></TooltipProvider>
    </QueryClientProvider></StrictMode>,
  )
}

void start().catch((error: unknown) => {
  const root = document.getElementById('root')!
  root.textContent = error instanceof Error ? `启动失败：${error.message}` : '启动失败，请刷新重试'
})
