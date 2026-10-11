import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import '../auth.css'
import { App } from './app/App'
import { TooltipProvider } from './shared/ui/tooltip/Tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider><App /></TooltipProvider>
  </StrictMode>,
)
