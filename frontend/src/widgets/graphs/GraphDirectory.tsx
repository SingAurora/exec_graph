import { ArrowUpDown, Network, Search, UserRound, UsersRound } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGraphActivity } from '../../entities/graph/lib/activity'
import { graphListKey, readGraphPage, type GraphListParams } from '../../entities/graph/api/graphs'
import type { CreateGraphInput } from '../../features/graph/model/types'
import { CreateGraphButton } from '../../features/graph/ui/CreateGraphButton'
import { Select } from '../../shared/ui/select/Select'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '../../shared/ui/tabs/Tabs'
import { Pagination } from '../../shared/ui/Pagination'
import { GraphList } from './GraphList'

type GraphGroup = 'all' | 'joined' | 'owned'
const graphPageSize = 10
const groups = [{ id: 'all', label: '全部', icon: Network }, { id: 'joined', label: '我参与的', icon: UsersRound }, { id: 'owned', label: '我发起的', icon: UserRound }] as const

/** Browses public graphs without introducing a join gate or a planned-action state. */
export function GraphDirectory({ currentUserUuid, onCreateGraph, onOpenGraph, readOnly = false }: {
  currentUserUuid: string
  onCreateGraph: (input: CreateGraphInput) => void | Promise<void>; onOpenGraph: (id: string) => void
  readOnly?: boolean
}) {
  const [group, setGroup] = useState<GraphGroup>('all')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState('activity')
  const [page, setPage] = useState(1)
  const visibleGroups = readOnly ? groups.filter(({ id }) => id === 'all') : groups
  const deferredKeyword = useDeferredValue(keyword)
  const params: GraphListParams = { page, pageSize: graphPageSize, filter: group, keyword: deferredKeyword.trim(), sort: sort as GraphListParams['sort'] }
  const result = useQuery({ queryKey: graphListKey(currentUserUuid, params), queryFn: ({ signal }) => readGraphPage(params, signal) })
  const summaries = (result.data?.items ?? []).map((graph) => getGraphActivity(graph, []))
  const currentPage = result.data?.page ?? page
  const pageCount = Math.max(1, Math.ceil((result.data?.total ?? 0) / graphPageSize))
  return (
    <section className="pt-6">
      <div className="flex items-center justify-between gap-5"><span className="text-sm text-muted">{result.data?.total ?? 0} 个公开行动图</span>{!readOnly && <CreateGraphButton onCreate={onCreateGraph} />}</div>
      <TabsRoot value={group} onValueChange={(value) => { setGroup(value as GraphGroup); setPage(1) }}>
        <TabsList showDivider={false}>{visibleGroups.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><span className="inline-flex items-center gap-1.5"><Icon size={16} />{label}</span></TabsTrigger>)}</TabsList>
        <div className="my-5 flex items-center gap-3">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 text-muted focus-within:border-signal"><Search size={16} /><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" type="search" title="搜索行动图" placeholder="搜索图名称或简介" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} /></label>
          <span className="flex items-center rounded-md border border-line bg-surface pl-3 text-muted"><ArrowUpDown size={15} /><Select label="行动图排序" value={sort} onValueChange={(value) => { setSort(value); setPage(1) }} options={[{ value: 'activity', label: '最近行动' }, { value: 'created', label: '最近创建' }, { value: 'name', label: '名称排序' }]} /></span>
        </div>
        {visibleGroups.map(({ id }) => <TabsContent key={id} value={id}><GraphList items={summaries} onOpen={onOpenGraph} showEnd={currentPage === pageCount} searchQuery={deferredKeyword.trim()} /></TabsContent>)}
      </TabsRoot>
      {result.data && pageCount > 1 && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setPage} />}
    </section>
  )
}
