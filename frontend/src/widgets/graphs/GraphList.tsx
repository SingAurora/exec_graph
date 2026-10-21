import { ArrowUpRight, Network } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GraphActivity } from '../../entities/project/model/types'
import { ProjectAvatar } from '../../entities/project/ui/ProjectAvatar'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { HighlightedText } from '../../shared/ui/HighlightedText'
import { getSearchExcerpt } from '../../shared/lib/search'

type Props = {
  items: GraphActivity[]
  onOpen: (id: string) => void
  empty?: string
  infinite?: boolean
  active?: boolean
  dividers?: boolean
  searchQuery?: string
}
const pageSize = 6

/** Compact graph identities with optional retained infinite scrolling for discovery. */
export function GraphList({ items, onOpen, empty = '暂无行动图', infinite = false, active = true, dividers = true, searchQuery }: Props) {
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const endRef = useRef<HTMLParagraphElement>(null)
  const hasMore = infinite && visibleCount < items.length
  useEffect(() => {
    const end = endRef.current
    if (!active || !hasMore || !end) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setVisibleCount((count) => Math.min(count + pageSize, items.length))
    }, { rootMargin: '160px 0px' })
    observer.observe(end)
    return () => observer.disconnect()
  }, [active, hasMore, items.length, visibleCount])
  if (!items.length) return <div className="empty-state" role="status"><Network size={24} strokeWidth={1.5} /><p>{empty}</p></div>
  return <div>
    <div className={dividers ? 'divide-y divide-line' : ''} aria-label="行动图列表">
      {(infinite ? items.slice(0, visibleCount) : items).map(({ project, participantCount, actionCount, expressionCount, lastActionAt }) => <button key={project.id} type="button" onClick={() => onOpen(project.id)} className="group flex w-full items-start gap-3.5 rounded-md border-0 bg-transparent px-2 py-5 text-left hover:bg-soft">
        <ProjectAvatar project={project} />
        <span className="grid min-w-0 flex-1 gap-1.5">
          <strong className="text-base font-semibold leading-6 group-hover:text-signal"><HighlightedText text={project.title} query={searchQuery} /></strong>
          {project.description && <span className="line-clamp-2 text-sm leading-6 text-copy"><HighlightedText text={searchQuery ? getSearchExcerpt(project.description, searchQuery) : project.description} query={searchQuery} /></span>}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-muted"><span>{participantCount} 人参与</span><span>{actionCount} 条行动</span><span>{expressionCount} 条表达</span>{lastActionAt && <time dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}</span>
        </span>
        <ArrowUpRight size={17} className="mt-1 shrink-0 text-muted group-hover:text-signal" />
      </button>)}
    </div>
    {infinite && <p ref={endRef} className="py-8 text-center text-xs leading-5 text-muted" role="status">{hasMore ? '加载中…' : '没有更多了'}</p>}
  </div>
}
