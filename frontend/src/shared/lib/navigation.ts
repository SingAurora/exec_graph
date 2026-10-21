import { useCallback, useEffect, useState } from 'react'

const appViews = ['home', 'following', 'publish', 'my', 'settings', 'topic', 'project', 'projects', 'action-archive', 'profile', 'graph-search'] as const
const authViews = ['login', 'register', 'forgot'] as const

/** Supported hash-route names, inferred from the runtime allowlist. */
export type AppView = typeof appViews[number]

/** Supported standalone authentication screens. */
export type AuthView = typeof authViews[number]

/** Checks a hash view against the supported application routes. */
export function isAppView(value: string): value is AppView {
  return appViews.includes(value as AppView)
}

/** Checks a standalone authentication view against its runtime allowlist. */
export function isAuthView(value: string): value is AuthView {
  return authViews.includes(value as AuthView)
}

/** Tracks valid hash-route names and falls back without rewriting an unknown URL. */
export function useHashRoute<T extends string>(fallback: T, isRoute: (value: string) => value is T) {
  const readRoute = useCallback(() => {
    const value = window.location.hash.slice(1).split('?')[0]
    return isRoute(value) ? value : fallback
  }, [fallback, isRoute])
  const [route, setRoute] = useState<T>(readRoute)

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [readRoute])

  const navigate = (nextRoute: T) => { window.location.hash = nextRoute }
  return [route, navigate] as const
}
