import { useEffect, useRef, useState } from 'react'

const batchSize = 6

/** 观察列表底部进入视野后加载一次；断开观察时也忽略已排队的过时回调。 */
export function observeListEnd(element: Element | null, enabled: boolean, loadMore: () => void): () => void {
  if (!element || !enabled) return () => {}
  let listening = true
  const observer = new IntersectionObserver((entries) => {
    if (!listening || !entries.some((entry) => entry.isIntersecting)) return
    listening = false
    observer.disconnect()
    loadMore()
  }, { rootMargin: '160px 0px' })
  observer.observe(element)
  return () => { listening = false; observer.disconnect() }
}

/** 对内存中的完整列表逐批展示，隐藏 Tab 保留数量但暂停观察；这里不请求远端下一页。 */
export function useInfiniteList({ itemCount, infinite, active }: { itemCount: number; infinite: boolean; active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(batchSize)
  const endRef = useRef<HTMLParagraphElement>(null)
  const hasMore = infinite && visibleCount < itemCount

  useEffect(() => observeListEnd(endRef.current, active && hasMore, () => {
    setVisibleCount((count) => Math.min(count + batchSize, itemCount))
  }), [active, hasMore, itemCount, visibleCount])

  return { visibleCount, endRef, hasMore }
}
