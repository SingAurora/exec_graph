export type ThemeMode = 'light' | 'dark'

type ThemeColor =
  | 'paper'
  | 'surface'
  | 'ink'
  | 'graphite'
  | 'rail'
  | 'signal'
  | 'moss'
  | 'amber'
  | 'clay'
  | 'moss-surface'
  | 'clay-surface'
  | 'edge'

const fallbacks: Record<ThemeColor, string> = {
  paper: '247 248 250',
  surface: '255 255 255',
  ink: '29 41 57',
  graphite: '102 112 133',
  rail: '228 231 236',
  signal: '22 119 255',
  moss: '46 139 87',
  amber: '217 119 6',
  clay: '209 67 67',
  'moss-surface': '237 248 241',
  'clay-surface': '255 241 240',
  edge: '152 162 179',
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  window.localStorage.setItem('exec-graph-theme', mode)
  window.dispatchEvent(new Event('exec-graph-theme-change'))
}

export function graphColor(token: ThemeColor) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim() || fallbacks[token]
  return `rgb(${value.trim().split(/\s+/).join(', ')})`
}
