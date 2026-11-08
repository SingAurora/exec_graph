import { ArrowUpRight } from 'lucide-react'
import { useInfiniteList } from '../../shared/lib/useInfiniteList'
import type { GraphActivity } from '../../entities/graph/model/types'
import { GraphAvatar } from '../../entities/graph/ui/GraphAvatar'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { HighlightedText } from '../../shared/ui/HighlightedText'
import { getSearchExcerpt } from '../../shared/lib/search'
import { ListEnd } from '../../shared/ui/ListEnd'
import { ListEmptyState } from '../../shared/ui/empty-state/EmptyState'

type Props = {
  items: GraphActivity[]
  onOpen: (id: string) => void
  infinite?: boolean
  active?: boolean
  dividers?: boolean
  searchQuery?: string
  showEnd?: boolean
}

/** Compact graph identities with optional retained infinite scrolling for discovery. */
export function GraphList({ items, onOpen, infinite = false, active = true, dividers = true, searchQuery, showEnd }: Props) {
  const { visibleCount, endRef, hasMore } = useInfiniteList({ itemCount: items.length, infinite, active })
  if (!items.length) return <ListEmptyState />
  return (
    <div>
      <div className={dividers ? 'divide-y divide-line' : ''}>
        {(infinite ? items.slice(0, visibleCount) : items).map(({ graph, participantCount, actionCount, expressionCount, lastActionAt }) => <button key={graph.uuid} type="button" onClick={() => onOpen(graph.uuid)} className="group flex w-full items-start gap-3.5 rounded-md border-0 bg-transparent px-2 py-5 text-left hover:bg-soft">
          <GraphAvatar graph={graph} />
          <span className="grid min-w-0 flex-1 gap-1.5">
            <strong className="text-base font-semibold leading-6 group-hover:text-signal"><HighlightedText text={graph.title} query={searchQuery} /></strong>
            {graph.description && <span className="line-clamp-2 text-sm leading-6 text-copy"><HighlightedText text={searchQuery ? getSearchExcerpt(graph.description, searchQuery) : graph.description} query={searchQuery} /></span>}
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-muted"><span>{participantCount} 人参与</span><span>{actionCount} 条行动</span><span>{expressionCount} 条表达</span>{lastActionAt && <time dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}</span>
          </span>
          <ArrowUpRight size={17} className="mt-1 shrink-0 text-muted group-hover:text-signal" />
        </button>)}
      </div>
      {(showEnd ?? infinite) && <ListEnd ref={endRef} hasMore={infinite && hasMore} className="py-8" />}
    </div>
  )
}
