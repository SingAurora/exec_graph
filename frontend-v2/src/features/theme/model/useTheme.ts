import { useEffect, useLayoutEffect, useState } from 'react'

const storageKey = 'exact.appearance.theme'

function readDarkMode() {
  try { return window.localStorage.getItem(storageKey) === 'dark' }
  catch { return false }
}

/** Keeps the explicit website theme consistent across refreshes and open tabs. */
export function useTheme() {
  const [darkMode, setDarkMode] = useState(readDarkMode)

  useLayoutEffect(() => {
    const theme = darkMode ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    try { window.localStorage.setItem(storageKey, theme) }
    catch { /* The selected theme still applies when browser storage is unavailable. */ }
  }, [darkMode])

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return
      if (event.key === storageKey || event.key === null) setDarkMode(readDarkMode())
    }
    window.addEventListener('storage', syncTheme)
    return () => window.removeEventListener('storage', syncTheme)
  }, [])

  return [darkMode, setDarkMode] as const
}
