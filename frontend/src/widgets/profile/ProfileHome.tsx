import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getProfileActivity, getProfileActivityDays } from '../../entities/action/lib/profile-activity'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import { ListEnd } from '../../shared/ui/ListEnd'
import { ListEmptyState } from '../../shared/ui/empty-state/EmptyState'
import { ActionHeatmap } from './ActionHeatmap'
import { ProfileTimelineItem } from './ProfileTimelineItem'

const pageSize = 10

/** Retained daily activity overview; only published actions contribute to the heatmap. */
export function ProfileHome({ userUuid, actions, active, onOpenNode }: {
  userUuid: string; actions: ActionNode[]; active: boolean
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const [selectedDate, setSelectedDate] = useState<string>()
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollTop = useRef(0)
  const endRef = useRef<HTMLParagraphElement>(null)
  const activity = useMemo(() => getProfileActivity(actions, userUuid), [actions, userUuid])
  const days = getProfileActivityDays(activity)
  const filtered = selectedDate ? activity.filter((item) => item.date === selectedDate) : activity
  const visibleActivity = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  useLayoutEffect(() => {
    if (active && timelineRef.current) timelineRef.current.scrollTop = scrollTop.current
  }, [active])
  useEffect(() => {
    const end = endRef.current
    const root = timelineRef.current
    if (!active || !hasMore || !end || !root) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setVisibleCount((count) => count + pageSize)
    }, { root, rootMargin: '80px 0px' })
    observer.observe(end)
    return () => observer.disconnect()
  }, [active, hasMore, visibleCount, selectedDate])
  const selectDate = (date: string) => {
    setSelectedDate((current) => current === date ? undefined : date)
    setVisibleCount(pageSize)
    scrollTop.current = 0
    if (timelineRef.current) timelineRef.current.scrollTop = 0
  }
  return (
    <div>
      <ActionHeatmap days={days} selectedDate={selectedDate} onSelectDate={selectDate} />
      <section className="pt-4">
        <div className="mb-5 flex min-h-7 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{selectedDate ? selectedDate.replaceAll('-', ' / ') : '时间线'}</h3>
          {selectedDate && <button type="button" className="text-button text-xs" onClick={() => selectDate(selectedDate)}>全部日期<X size={13} /></button>}
        </div>
        <div ref={timelineRef} className="h-[420px] overflow-y-auto overscroll-contain rounded-lg border border-line px-4 py-4 [scrollbar-gutter:stable]" tabIndex={0}
          onScroll={(event) => { if (active) scrollTop.current = event.currentTarget.scrollTop }}>
          {!filtered.length && (selectedDate ? <p className="py-12 text-center text-sm text-muted">这一天没有行动</p> : <ListEmptyState compact />)}
          <div>{visibleActivity.map((item, index) => <ProfileTimelineItem key={item.node.uuid} node={item.node} last={index === visibleActivity.length - 1} onOpenNode={onOpenNode} />)}</div>
          {filtered.length > 0 && <ListEnd ref={endRef} hasMore={hasMore} className="py-6" />}
        </div>
      </section>
    </div>
  )
}
