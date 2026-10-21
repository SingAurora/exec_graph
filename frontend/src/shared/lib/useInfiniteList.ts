import { useEffect, useRef, useState } from 'react'

const batchSize = 6

/** Observes one visible-list boundary once; cleanup also ignores already queued callbacks. */
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

/** Retains loaded items across hidden tabs and loads another batch only while active. */
export function useInfiniteList({ itemCount, infinite, active }: { itemCount: number; infinite: boolean; active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(batchSize)
  const endRef = useRef<HTMLParagraphElement>(null)
  const hasMore = infinite && visibleCount < itemCount

  useEffect(() => observeListEnd(endRef.current, active && hasMore, () => {
    setVisibleCount((count) => Math.min(count + batchSize, itemCount))
  }), [active, hasMore, itemCount, visibleCount])

  return { visibleCount, endRef, hasMore }
}
