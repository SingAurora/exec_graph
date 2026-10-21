import { useMemo, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { searchPublicGraphs } from '../../../features/search-graphs/lib/search'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import type { Project } from '../../../entities/project/model/types'
import { Pagination } from '../../../shared/ui/Pagination'
import { GraphList } from '../../graphs/GraphList'

type Props = {
  projects: Project[]
  actions: ActionNode[]
  keyword: string
  page: number
  onSearch: (keyword: string) => void
  onPageChange: (page: number) => void
  onOpenProject: (id: string) => void
}
const pageSize = 10

/** Full graph search with shareable keywords and pagination, reached from the discovery sidebar. */
export function GraphSearchResults({ projects, actions, keyword, page, onSearch, onPageChange, onOpenProject }: Props) {
  const [draft, setDraft] = useState(keyword)
  const items = useMemo(() => searchPublicGraphs(projects, actions, keyword), [projects, actions, keyword])
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  return <section className="pt-6" aria-label="图搜索结果">
    <form className="flex items-center gap-3" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()) }}>
      <div className="min-w-0 flex-1"><DiscoverySearch label="图" value={draft} onChange={setDraft} size="wide" clearLabel="清除图搜索" onClear={() => { setDraft(''); onSearch('') }} /></div>
      <button type="submit" className="quiet-button h-10">搜索</button>
    </form>
    {keyword && <p className="mt-4 text-xs leading-5 text-muted" role="status">找到 {items.length} 个图</p>}
    <GraphList items={items.slice((currentPage - 1) * pageSize, currentPage * pageSize)} searchQuery={keyword} onOpen={onOpenProject} dividers={false} empty={keyword ? '没有找到相关图' : '输入图名称或简介搜索'} />
    {items.length > pageSize && <Pagination label="图搜索分页" currentPage={currentPage} pageCount={pageCount} onChange={onPageChange} />}
  </section>
}
