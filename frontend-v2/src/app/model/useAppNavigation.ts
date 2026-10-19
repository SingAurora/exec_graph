import { useLayoutEffect, useRef, useState } from 'react'
import { isAppView, isAuthView } from '../../shared/lib/navigation'
import type { AppView } from '../../shared/model'

function readHash() {
  return window.location.hash.slice(1) || 'my'
}
function viewOf(hash: string) {
  return hash.split('?')[0]
}

/** Keeps global list screens and their browser-back positions separate from graph reading state. */
export function useAppNavigation() {
  const [hash, setHash] = useState(readHash)
  const [revision, setRevision] = useState(0)
  const currentHash = useRef(hash)
  const graphBackHash = useRef('projects')
  const profileBackHash = useRef('my')
  const positions = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const sync = () => {
      const next = readHash()
      const previous = currentHash.current
      positions.current.set(previous, window.scrollY)
      const previousView = viewOf(previous)
      const nextView = viewOf(next)
      if (nextView === 'project' && !['project', 'publish', 'action-archive'].includes(previousView) && !(previousView === 'profile' && previous.includes('fromGraph='))) graphBackHash.current = previous
      if (nextView === 'profile' && previousView !== 'profile') profileBackHash.current = previous
      currentHash.current = next
      setHash(next)
      setRevision((value) => value + 1)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const rawView = viewOf(hash)
  const route: AppView = isAppView(rawView) && rawView !== 'topic' ? rawView : 'home'
  const authRoute = isAuthView(rawView) ? rawView : undefined
  useLayoutEffect(() => {
    // The graph owns its own tab/reading positions, including returns from an editor.
    if (route === 'project') return
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: positions.current.get(hash) ?? 0, behavior: 'instant' }))
    return () => window.cancelAnimationFrame(frame)
  }, [hash, route])
  return { hash, revision, route, authRoute, graphBackHash: graphBackHash.current, profileBackHash: profileBackHash.current, navigate: (next: string) => { window.location.hash = next } }
}
