import { useLayoutEffect, useRef, useState } from 'react'
import { isAppView, isAuthView } from '../../shared/lib/navigation'
import type { AppView } from '../../shared/lib/navigation'
import { getNavigationPositionKey } from './navigation-position'

function readHash() {
  return window.location.hash.slice(1) || 'my'
}
function viewOf(hash: string) {
  return hash.split('?')[0]
}

/** 以 URL 的 # 后内容管理前端路由，并保留全局页面的返回目标和滚动位置。 */
export function useAppNavigation(currentUserId: string) {
  const [hash, setHash] = useState(readHash)
  const [revision, setRevision] = useState(0)
  // state 驱动画面更新；ref 让事件回调拿到最新地址，并保存不需要直接渲染的阅读记录。
  const currentHash = useRef(hash)
  const graphBackHash = useRef('projects')
  const profileBackHash = useRef('my')
  const positions = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const sync = () => {
      const next = readHash()
      const previous = currentHash.current
      positions.current.set(getNavigationPositionKey(previous, currentUserId), window.scrollY)
      const previousView = viewOf(previous)
      const nextView = viewOf(next)
      if (nextView === 'project' && !['project', 'publish', 'action-archive'].includes(previousView) && !(previousView === 'profile' && previous.includes('fromGraph='))) graphBackHash.current = previous
      if (nextView === 'profile' && previousView !== 'profile') profileBackHash.current = previous
      currentHash.current = next
      setHash(next)
      setRevision((value) => value + 1)
    }
    // 点击 # 链接以及浏览器前进／后退都会触发；effect 退出时移除监听，避免重复注册。
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [currentUserId])
  const rawView = viewOf(hash)
  const route: AppView = isAppView(rawView) && rawView !== 'topic' ? rawView : 'home'
  const authRoute = isAuthView(rawView) ? rawView : undefined
  useLayoutEffect(() => {
    // 图详情自行恢复各 Tab 的阅读状态，避免全局恢复再次覆盖它的定位。
    if (route === 'project') return
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: positions.current.get(getNavigationPositionKey(hash, currentUserId)) ?? 0, behavior: 'instant' }))
    return () => window.cancelAnimationFrame(frame)
  }, [hash, route, currentUserId])
  // 改 hash 不会请求一个新的 HTML 页面；事件监听把新地址同步成 React 状态。
  return { hash, revision, route, authRoute, graphBackHash: graphBackHash.current, profileBackHash: profileBackHash.current, navigate: (next: string) => { window.location.hash = next } }
}
