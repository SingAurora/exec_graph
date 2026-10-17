import { useEffect, useState } from 'react'

function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  const color = (token: string) => styles.getPropertyValue(token).trim()
  return { surface: color('--surface'), soft: color('--soft'), line: color('--line'), ink: color('--ink'),
    muted: color('--muted'), signal: color('--signal'), signalSoft: color('--signal-soft'),
    blue: color('--graph-blue'), purple: color('--graph-purple'), coral: color('--coral') }
}

/** Canvas renderers need resolved colors; update them with the existing app theme. */
export function useGraphPalette() {
  const [palette, setPalette] = useState(readPalette)
  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return palette
}

/** Theme colors resolved from the application's shared CSS tokens. */
export type GraphPalette = ReturnType<typeof readPalette>
