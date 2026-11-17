import { useLayoutEffect, useState } from 'react'
import { useAppearanceStore } from '../../../features/appearance/model/appearance-store'

function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  const color = (token: string) => styles.getPropertyValue(token).trim()
  return { surface: color('--surface'), soft: color('--soft'), line: color('--line'), ink: color('--ink'),
    muted: color('--muted'), signal: color('--signal'), signalSoft: color('--signal-soft'),
    blue: color('--graph-blue'), purple: color('--graph-purple'), coral: color('--coral') }
}

/** Canvas renderers need resolved colors; re-read CSS tokens when the stored theme changes. */
export function useGraphPalette() {
  const theme = useAppearanceStore((state) => state.theme)
  const [palette, setPalette] = useState(readPalette)

  useLayoutEffect(() => {
    setPalette(readPalette())
  }, [theme])

  return palette
}

/** Theme colors resolved from the application's shared CSS tokens. */
export type GraphPalette = ReturnType<typeof readPalette>
