import { useCallback, useEffect, useState } from 'react'
import type { AppView, AuthView } from '../model'

const appViews: AppView[] = ['home', 'today', 'actions', 'records', 'following', 'people', 'settings']
const authViews: AuthView[] = ['login', 'register', 'forgot']

export function isAppView(value: string): value is AppView {
  return appViews.includes(value as AppView)
}

export function isAuthView(value: string): value is AuthView {
  return authViews.includes(value as AuthView)
}

export function useHashRoute<T extends string>(fallback: T, isRoute: (value: string) => value is T) {
  const readRoute = useCallback(() => {
    const value = window.location.hash.slice(1)
    return isRoute(value) ? value : fallback
  }, [fallback, isRoute])
  const [route, setRoute] = useState<T>(readRoute)

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [readRoute])

  const navigate = (nextRoute: T) => {
    window.location.hash = nextRoute
  }

  return [route, navigate] as const
}
