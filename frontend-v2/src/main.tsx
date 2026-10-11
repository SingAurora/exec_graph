import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { App } from './app/App'
import { TooltipProvider } from './shared/ui/tooltip/Tooltip'
import { ToastProvider } from './shared/ui/toast/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider><ToastProvider><App /></ToastProvider></TooltipProvider>
  </StrictMode>,
)
