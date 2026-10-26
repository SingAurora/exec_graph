import { useEffect, useState } from 'react'

/** 登录前后共用同一个本机主题偏好。 */
export function useAppearance() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('exact.appearance.theme') === 'dark' } catch { return false }
  })
  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('exact.appearance.theme', darkMode ? 'dark' : 'light') } catch { /* 本机偏好不影响业务操作。 */ }
  }, [darkMode])
  return [darkMode, () => setDarkMode((current) => !current)] as const
}
