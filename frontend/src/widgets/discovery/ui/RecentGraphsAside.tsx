import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { getGraphActivity } from '../../../entities/graph/lib/activity'
import { readGraphPage } from '../../../entities/graph/api/graphs'
import type { GraphActivity } from '../../../entities/graph/model/types'
import { GraphAvatar } from '../../../entities/graph/ui/GraphAvatar'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { ListEmptyState } from '../../../shared/ui/empty-state/EmptyState'
import { ListSkeleton } from '../../../shared/ui/ListSkeleton'

type Props = {
  items: GraphActivity[]
  onOpen: (id: string) => void
  onSearchAll: (keyword: string) => void
}

/** 近期活跃图预览；输入关键词时改为服务端搜索，空图也能被找到。 */
export function RecentGraphsAside({ items, onOpen, onSearchAll }: Props) {
  const [keyword, setKeyword] = useState('')
  const query = useDeferredValue(keyword.trim())
  const search = useQuery({
    queryKey: ['graphs', 'discovery-search', query],
    queryFn: ({ signal }) => readGraphPage({ page: 1, pageSize: 20, filter: 'all', keyword: query, sort: 'activity' }, signal),
    enabled: Boolean(query),
  })
  const results = (search.data?.items ?? []).map((graph) => getGraphActivity(graph, []))
  const visibleItems = query ? results : items
  const total = search.data?.total ?? 0
  return (
    <aside className="sticky top-16 mt-4 min-w-0 rounded-lg bg-soft p-4">
      <h2 className="text-sm font-semibold leading-6" id="discovery-recent-graphs">{query ? '搜索结果' : '近期活跃的图'}</h2>
      <div className="mt-3"><DiscoverySearch label="图" value={keyword} onChange={setKeyword} size="sidebar" clearLabel="清除图搜索" /></div>
      {query && <p className="mt-2 text-xs leading-5 text-muted">找到 {total} 个图</p>}
      {query && search.isLoading
        ? <ListSkeleton rows={3} compact className="mt-4" />
        : visibleItems.length ? <div className="mt-4 grid gap-5">
          {visibleItems.slice(0, 3).map(({ graph, participantCount, lastActionAt }) => <button className="group flex min-w-0 items-start gap-2.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" key={graph.uuid} onClick={() => onOpen(graph.uuid)}>
            <GraphAvatar graph={graph} size="compact" />
            <span className="grid min-w-0 flex-1 gap-1">
              <strong className="line-clamp-2 text-[13px] font-medium leading-5 group-hover:text-signal"><HighlightedText text={graph.title} query={query} /></strong>
              {query && graph.description && <span className="line-clamp-2 text-xs leading-5 text-copy"><HighlightedText text={getSearchExcerpt(graph.description, query)} query={query} /></span>}
              <span className="text-xs leading-5 text-muted">{participantCount} 人参与</span>
              {!query && lastActionAt && <time className="text-[11px] leading-5 text-muted" dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}
            </span>
          </button>)}
        </div> : <ListEmptyState compact />}
      {query && total > 3 && <button type="button" onClick={() => onSearchAll(query)} className="mt-4 inline-flex items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-xs font-medium leading-5 text-signal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">查看更多<ArrowRight size={13} /></button>}
    </aside>
  )
}
