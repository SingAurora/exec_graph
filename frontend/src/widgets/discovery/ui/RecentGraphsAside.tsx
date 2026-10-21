import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import type { GraphActivity, Project } from '../../../entities/project/model/types'
import { ProjectAvatar } from '../../../entities/project/ui/ProjectAvatar'
import { searchPublicGraphs } from '../../../features/search-graphs/lib/search'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'

type Props = {
  items: GraphActivity[]
  projects: Project[]
  actions: ActionNode[]
  onOpen: (id: string) => void
  onSearchAll: (keyword: string) => void
}

/** Keeps graph search independent of the main feed, defaulting to three recently active graphs. */
export function RecentGraphsAside({ items, projects, actions, onOpen, onSearchAll }: Props) {
  const [keyword, setKeyword] = useState('')
  const query = keyword.trim()
  const results = useMemo(() => searchPublicGraphs(projects, actions, query), [projects, actions, query])
  const visibleItems = query ? results : items
  return <aside className="sticky top-16 mt-4 min-w-0 rounded-lg bg-soft p-4" aria-labelledby="discovery-recent-graphs">
    <h2 className="text-sm font-semibold leading-6" id="discovery-recent-graphs">{query ? '搜索结果' : '近期活跃的图'}</h2>
    <div className="mt-3"><DiscoverySearch label="图" value={keyword} onChange={setKeyword} size="sidebar" clearLabel="清除图搜索" /></div>
    {query && <p className="mt-2 text-xs leading-5 text-muted" role="status">找到 {results.length} 个图</p>}
    {visibleItems.length ? <div className="mt-4 grid gap-5">
      {visibleItems.slice(0, 3).map(({ project, participantCount, lastActionAt }) => <button className="group flex min-w-0 items-start gap-2.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" key={project.id} onClick={() => onOpen(project.id)}>
        <ProjectAvatar project={project} size="compact" />
        <span className="grid min-w-0 flex-1 gap-1">
          <strong className="line-clamp-2 text-[13px] font-medium leading-5 group-hover:text-signal"><HighlightedText text={project.title} query={query} /></strong>
          {query && project.description && <span className="line-clamp-2 text-xs leading-5 text-copy"><HighlightedText text={getSearchExcerpt(project.description, query)} query={query} /></span>}
          <span className="text-xs leading-5 text-muted">{participantCount} 人参与</span>
          {!query && lastActionAt && <time className="text-[11px] leading-5 text-muted" dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}
        </span>
      </button>)}
    </div> : <p className="py-5 text-center text-sm text-muted" role="status">{query ? '没有找到相关图' : '暂无活跃的图'}</p>}
    {query && results.length > 3 && <button type="button" onClick={() => onSearchAll(query)} className="mt-4 inline-flex items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-xs font-medium leading-5 text-signal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">查看更多<ArrowRight size={13} /></button>}
  </aside>
}
