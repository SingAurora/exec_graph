import { ArrowUpDown, Network, Search, UserRound, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { getGraphActivity, hasUserContributed } from '../../entities/project/lib/activity'
import type { ActionNode } from '../../entities/action/model/types'
import type { Project } from '../../entities/project/model/types'
import type { CreateProjectInput } from '../../features/project/model/types'
import { CreateGraphButton } from '../../features/project/ui/CreateGraphButton'
import { Select } from '../../shared/ui/select/Select'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '../../shared/ui/tabs/Tabs'
import { Pagination } from '../../shared/ui/Pagination'
import { GraphList } from './GraphList'

type GraphGroup = 'all' | 'joined' | 'owned'
const graphPageSize = 10
const groups = [{ id: 'all', label: '全部', icon: Network }, { id: 'joined', label: '我参与的', icon: UsersRound }, { id: 'owned', label: '我发起的', icon: UserRound }] as const

/** Browses public graphs without introducing a join gate or a planned-action state. */
export function GraphDirectory({ currentUserId, projects, actions, onCreateProject, onOpenProject }: {
  currentUserId: string; projects: Project[]; actions: ActionNode[]
  onCreateProject: (input: CreateProjectInput) => void | Promise<void>; onOpenProject: (id: string) => void
}) {
  const [group, setGroup] = useState<GraphGroup>('all')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState('activity')
  const [page, setPage] = useState(1)
  const summaries = projects.map((project) => getGraphActivity(project, actions))
  const query = keyword.trim().toLocaleLowerCase('zh-CN')
  const filtered = summaries.filter(({ project }) => (group === 'all' || (group === 'owned' ? project.ownerId === currentUserId : hasUserContributed(project.id, currentUserId, actions))) && `${project.title} ${project.description}`.toLocaleLowerCase('zh-CN').includes(query))
    .sort((a, b) => sort === 'name' ? a.project.title.localeCompare(b.project.title, 'zh-CN') : Date.parse(sort === 'created' ? b.project.createdAt : b.lastActionAt ?? b.project.createdAt) - Date.parse(sort === 'created' ? a.project.createdAt : a.lastActionAt ?? a.project.createdAt))
  const pageCount = Math.max(1, Math.ceil(filtered.length / graphPageSize))
  const currentPage = Math.min(page, pageCount)
  return (
    <section className="pt-6">
      <div className="flex items-center justify-between gap-5"><span className="text-sm text-muted">{projects.length} 个公开行动图</span><CreateGraphButton onCreate={onCreateProject} /></div>
      <TabsRoot value={group} onValueChange={(value) => { setGroup(value as GraphGroup); setPage(1) }}>
        <TabsList showDivider={false}>{groups.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><span className="inline-flex items-center gap-1.5"><Icon size={16} />{label}</span></TabsTrigger>)}</TabsList>
        <div className="my-5 flex items-center gap-3">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 text-muted focus-within:border-signal"><Search size={16} /><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" type="search" title="搜索行动图" placeholder="搜索图名称或简介" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} /></label>
          <span className="flex items-center rounded-md border border-line bg-surface pl-3 text-muted"><ArrowUpDown size={15} /><Select label="行动图排序" value={sort} onValueChange={(value) => { setSort(value); setPage(1) }} options={[{ value: 'activity', label: '最近行动' }, { value: 'created', label: '最近创建' }, { value: 'name', label: '名称排序' }]} /></span>
        </div>
        {groups.map(({ id }) => <TabsContent key={id} value={id}><GraphList items={filtered.slice((currentPage - 1) * graphPageSize, currentPage * graphPageSize)} onOpen={onOpenProject} empty={query ? '没有找到相关行动图' : '暂无行动图'} /></TabsContent>)}
      </TabsRoot>
      {filtered.length > graphPageSize && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setPage} />}
    </section>
  )
}
