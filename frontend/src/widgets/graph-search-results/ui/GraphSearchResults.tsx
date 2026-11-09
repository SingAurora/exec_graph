import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ActionNode } from '../../../entities/action/model/types'
import { searchPublicGraphs } from '../../../features/search-graphs/lib/search'
import { getGraphActivity } from '../../../entities/graph/lib/activity'
import { graphListKey, readGraphPage } from '../../../entities/graph/api/graphs'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import type { Graph } from '../../../entities/graph/model/types'
import { Pagination } from '../../../shared/ui/Pagination'
import { GraphList } from '../../graphs/GraphList'

type Props = {
  graphs?: Graph[]
  actions?: ActionNode[]
  keyword: string
  page: number
  onSearch: (keyword: string) => void
  onPageChange: (page: number) => void
  onOpenGraph: (id: string) => void
}
const pageSize = 10

/** Full graph search with shareable keywords and pagination, reached from the discovery sidebar. */
export function GraphSearchResults({ graphs, actions, keyword, page, onSearch, onPageChange, onOpenGraph }: Props) {
  const [draft, setDraft] = useState(keyword)
  const server = !graphs
  const result = useQuery({ queryKey: graphListKey('search', { page, pageSize, filter: 'all', keyword, sort: 'activity' }), queryFn: ({ signal }) => readGraphPage({ page, pageSize, filter: 'all', keyword, sort: 'activity' }, signal), enabled: server })
  const items = useMemo(() => server ? (result.data?.items ?? []).map((graph) => getGraphActivity(graph, [])) : searchPublicGraphs(graphs, actions ?? [], keyword), [actions, graphs, keyword, result.data?.items, server])
  const pageCount = Math.max(1, Math.ceil((server ? result.data?.total ?? 0 : items.length) / pageSize))
  const currentPage = Math.min(page, pageCount)
  useEffect(() => { if (server && result.data && page > pageCount) onPageChange(pageCount) }, [onPageChange, page, pageCount, result.data, server])
  return (
    <section className="pt-6">
      <form className="flex items-center gap-3" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()) }}>
        <div className="min-w-0 flex-1"><DiscoverySearch label="图" value={draft} onChange={setDraft} size="wide" clearLabel="清除图搜索" onClear={() => { setDraft(''); onSearch('') }} /></div>
        <button type="submit" className="quiet-button h-10">搜索</button>
      </form>
      {keyword && <p className="mt-4 text-xs leading-5 text-muted">找到 {server ? result.data?.total ?? 0 : items.length} 个图</p>}
      {server && result.isLoading && <p className="empty-state">加载中…</p>}
      {server && result.error && <p className="empty-state">{result.error.message}</p>}
      <GraphList items={server ? items : items.slice((currentPage - 1) * pageSize, currentPage * pageSize)} searchQuery={keyword} onOpen={onOpenGraph} dividers={false} showEnd={currentPage === pageCount} />
      {((server ? (result.data?.total ?? 0) : items.length) > pageSize) && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={onPageChange} />}
    </section>
  )
}
