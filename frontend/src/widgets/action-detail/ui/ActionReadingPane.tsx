import { useLayoutEffect, useRef, type ReactNode } from 'react'
import './action-reading.css'

type ActionReadingPaneProps = {
  readingKey: string
  focusRequest: number
  active: boolean
  hidden?: boolean
  label: string
  children: ReactNode
}

/** 用 readingKey 分别保存每个节点／文档的位置；普通切换恢复，显式重新定位则从顶部读。 */
export function ActionReadingPane({ readingKey, focusRequest, active, hidden = false, label, children }: ActionReadingPaneProps) {
  const pane = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, number>())
  const lastFocus = useRef(focusRequest)
  useLayoutEffect(() => {
    if (!active || !pane.current) return
    const locating = lastFocus.current !== focusRequest
    lastFocus.current = focusRequest
    const top = locating ? 0 : positions.current.get(readingKey) ?? 0
    pane.current.scrollTop = top
    positions.current.set(readingKey, top)
  }, [readingKey, focusRequest, active])
  return (
    <div ref={pane} hidden={hidden} className={`min-h-0 min-w-0 overflow-y-auto overscroll-y-contain [overflow-anchor:none] [scrollbar-width:thin] ${hidden ? 'hidden' : ''}`} aria-label={label} onScroll={(event) => { if (active) positions.current.set(readingKey, event.currentTarget.scrollTop) }}>{children}</div>
  )
}
