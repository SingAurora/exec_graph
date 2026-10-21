import { useEffect, useState } from 'react'
import { createDefaultGraphBackground, normalizeGraphBackground } from '../../../shared/ui/graph-background/model'

const storageKey = 'exact.actionGraph.background.v1'

/** Stores only personal graph appearance, never graph data or document contents. */
export function useGraphBackground() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
      return normalizeGraphBackground(saved)
    }
    catch { return createDefaultGraphBackground() }
  })
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)) }
    catch { /* Preferences still apply for this session when browser storage is unavailable. */ }
  }, [preferences])
  return [preferences, setPreferences] as const
}
