import { useMemo, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { searchPublicGraphs } from '../../../features/search-graphs/lib/search'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import type { Graph } from '../../../entities/graph/model/types'
import { Pagination } from '../../../shared/ui/Pagination'
import { GraphList } from '../../graphs/GraphList'

type Props = {
  graphs: Graph[]
  actions: ActionNode[]
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
  const items = useMemo(() => searchPublicGraphs(graphs, actions, keyword), [graphs, actions, keyword])
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  return (
    <section className="pt-6">
      <form className="flex items-center gap-3" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()) }}>
        <div className="min-w-0 flex-1"><DiscoverySearch label="图" value={draft} onChange={setDraft} size="wide" clearLabel="清除图搜索" onClear={() => { setDraft(''); onSearch('') }} /></div>
        <button type="submit" className="quiet-button h-10">搜索</button>
      </form>
      {keyword && <p className="mt-4 text-xs leading-5 text-muted">找到 {items.length} 个图</p>}
      <GraphList items={items.slice((currentPage - 1) * pageSize, currentPage * pageSize)} searchQuery={keyword} onOpen={onOpenGraph} dividers={false} showEnd={currentPage === pageCount} />
      {items.length > pageSize && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={onPageChange} />}
    </section>
  )
}
