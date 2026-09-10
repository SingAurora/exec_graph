import { Toaster as Sonner } from 'sonner'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function Toaster() {
  const [theme, setTheme] = useState(currentTheme)

  useEffect(() => {
    const syncTheme = () => setTheme(currentTheme())
    window.addEventListener('exec-graph-theme-change', syncTheme)
    return () => window.removeEventListener('exec-graph-theme-change', syncTheme)
  }, [])

  return (
    <Sonner
      position="top-center"
      theme={theme}
      duration={1200}
      style={{ '--width': 'max-content' } as CSSProperties}
      toastOptions={{
        style: {
          width: 'fit-content',
          minHeight: 'auto',
          padding: '6px 10px',
          gap: '4px',
          borderRadius: '6px',
        },
        classNames: {
          toast: '!w-max !min-w-0 !max-w-[calc(100vw-2rem)] !border-rail !bg-surface !text-ink shadow-lg',
          title: 'text-xs font-semibold leading-4',
          success: '!border-rail',
          error: '!border-rail',
        },
      }}
    />
  )
}
