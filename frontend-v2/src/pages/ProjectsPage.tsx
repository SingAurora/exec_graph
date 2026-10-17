import { ArrowLeft, ArrowRight, ArrowUpDown, FolderKanban, Plus, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CreateProjectInput } from '../features/project/model/types'
import { CreateProjectDialog } from '../features/project/ui/CreateProjectDialog'
import { formatDateTime } from '../shared/lib/date'
import type { ActionTopic, CompletionNode, PlanNode, Project } from '../shared/model'
import { Select } from '../shared/ui/select/Select'

type ProjectGroup = 'owned' | 'joined'
type ProjectSort = 'updated-desc' | 'created-desc' | 'name-asc'

const PAGE_SIZE = 10

type ProjectsPageProps = {
  currentUserId: string
  projects: Project[]
  topics: ActionTopic[]
  plans: PlanNode[]
  completions: CompletionNode[]
  onBack: () => void
  onCreateProject: (input: CreateProjectInput) => void
  onOpenProject: (projectId: string) => void
}

export function ProjectsPage({ currentUserId, projects, topics, plans, completions, onBack, onCreateProject, onOpenProject }: ProjectsPageProps) {
  const [activeGroup, setActiveGroup] = useState<ProjectGroup>('owned')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<ProjectSort>('updated-desc')
  const [page, setPage] = useState(1)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const createProjectButtonRef = useRef<HTMLButtonElement>(null)
  const ownedProjects = projects.filter((project) => project.ownerId === currentUserId)
  const joinedProjects = projects.filter((project) => project.ownerId !== currentUserId && project.participantIds.includes(currentUserId))
  const groupProjects = activeGroup === 'owned' ? ownedProjects : joinedProjects
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('zh-CN')
  const filteredProjects = groupProjects
    .filter((project) => !normalizedKeyword || `${project.title} ${project.description}`.toLocaleLowerCase('zh-CN').includes(normalizedKeyword))
    .sort((left, right) => compareProjects(left, right, sort))
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const changeGroup = (group: ProjectGroup) => { setActiveGroup(group); setPage(1) }
  const changeKeyword = (value: string) => { setKeyword(value); setPage(1) }
  const changeSort = (value: ProjectSort) => { setSort(value); setPage(1) }

  return <section className="pt-[34px] max-[700px]:pt-[26px]">
    <div className="flex items-center justify-between gap-4 pb-[18px]"><button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />回到首页</button><button ref={createProjectButtonRef} className="primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={16} />发起行动图</button></div>
    <nav className="flex gap-7 border-b border-line max-[700px]:gap-5" role="tablist" aria-label="行动图分类">
      <button className={`inline-flex min-h-[43px] items-center gap-2 border-0 border-b-2 border-transparent bg-transparent px-px text-[13px] font-bold text-muted hover:text-ink ${activeGroup === 'owned' ? 'border-signal text-ink' : ''}`} type="button" role="tab" aria-selected={activeGroup === 'owned'} onClick={() => changeGroup('owned')}>我发起的行动图<span className={`grid size-[18px] min-w-[18px] place-items-center rounded-full bg-soft px-[5px] text-[10px] text-muted ${activeGroup === 'owned' ? 'bg-signal-soft text-signal' : ''}`}>{ownedProjects.length}</span></button>
      <button className={`inline-flex min-h-[43px] items-center gap-2 border-0 border-b-2 border-transparent bg-transparent px-px text-[13px] font-bold text-muted hover:text-ink ${activeGroup === 'joined' ? 'border-signal text-ink' : ''}`} type="button" role="tab" aria-selected={activeGroup === 'joined'} onClick={() => changeGroup('joined')}>我参与的行动图<span className={`grid size-[18px] min-w-[18px] place-items-center rounded-full bg-soft px-[5px] text-[10px] text-muted ${activeGroup === 'joined' ? 'bg-signal-soft text-signal' : ''}`}>{joinedProjects.length}</span></button>
    </nav>
    <div className="flex items-center gap-2.5 py-5 pb-3.5 max-[700px]:flex-col max-[700px]:items-stretch">
      <label className="flex min-h-[38px] w-[min(100%,460px)] items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 text-muted focus-within:border-signal focus-within:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)] max-[700px]:w-full"><span className="sr-only">搜索行动图</span><Search size={16} /><input className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-xs text-ink outline-none" type="search" value={keyword} placeholder="搜索行动图名称或说明" onChange={(event) => changeKeyword(event.target.value)} />{keyword && <button className="grid size-[26px] flex-none place-items-center rounded border-0 bg-transparent text-muted hover:bg-soft hover:text-ink" type="button" aria-label="清除搜索" title="清除搜索" onClick={() => changeKeyword('')}><X size={15} /></button>}</label>
      <div className="ml-auto flex min-h-[38px] items-center rounded-md border border-line bg-surface pl-2.5 text-muted max-[700px]:ml-0"><ArrowUpDown size={15} /><Select ariaLabel="行动图排序" value={sort} onValueChange={(value) => changeSort(value as ProjectSort)} options={[{ value: 'updated-desc', label: '最近更新' }, { value: 'created-desc', label: '最近创建' }, { value: 'name-asc', label: '行动图名称' }]} /></div>
    </div>
    <div className="flex items-center justify-between gap-4 px-0.5 pb-3 pt-[3px] text-[11px] text-muted"><span>共 {filteredProjects.length} 个行动图</span><span className="font-bold text-signal">{activeGroup === 'owned' ? '我发起的行动图' : '我参与的行动图'}</span></div>
    <ProjectList projects={pageProjects} topics={topics} plans={plans} completions={completions} onOpenProject={onOpenProject} emptyMessage={normalizedKeyword ? '没有找到相关行动图。' : '暂无行动图。'} dateField={sort === 'created-desc' ? 'createdAt' : 'updatedAt'} />
    {filteredProjects.length > 0 && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setPage} />}
    {showCreateDialog && <CreateProjectDialog returnFocusRef={createProjectButtonRef} onClose={() => setShowCreateDialog(false)} onCreate={onCreateProject} />}
  </section>
}

function ProjectList({ projects, topics, plans, completions, onOpenProject, emptyMessage, dateField }: Pick<ProjectsPageProps, 'projects' | 'topics' | 'plans' | 'completions' | 'onOpenProject'> & { emptyMessage: string; dateField: 'createdAt' | 'updatedAt' }) {
  return <div className="border-t border-line">{projects.map((project) => {
    const topicIds = new Set(topics.filter((topic) => topic.projectId === project.id).map((topic) => topic.id))
    const projectPlans = plans.filter((plan) => topicIds.has(plan.topicId))
    const projectCompletions = completions.filter((completion) => topicIds.has(completion.topicId))
    const activeCount = projectPlans.filter((plan) => plan.status === 'active').length
    return <button className="grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3.5 border-0 border-b border-line bg-transparent px-1 py-5 text-left text-ink hover:bg-soft max-[700px]:grid-cols-[40px_minmax(0,1fr)]" type="button" onClick={() => onOpenProject(project.id)} key={project.id}><span className="grid size-10 place-items-center rounded-md bg-signal-soft text-signal"><FolderKanban size={19} /></span><span className="grid min-w-0 gap-1"><strong className="text-[15px]">{project.title}</strong><small className="text-xs leading-[1.5] text-muted">{project.description}</small><span className="text-[10px] font-bold text-signal">{activeCount} 项进行中 · {projectPlans.length} 项计划 · {projectCompletions.length} 条完成</span></span><span className="flex items-center gap-2.5 text-[11px] text-muted max-[700px]:col-start-2 max-[700px]:justify-between">{dateField === 'createdAt' ? '创建' : '更新'} {formatDateTime(project[dateField])}<ArrowRight className="text-signal" size={16} /></span></button>
  })}{!projects.length && <p className="py-[25px] text-[13px] text-muted">{emptyMessage}</p>}</div>
}

function Pagination({ currentPage, pageCount, onChange }: { currentPage: number; pageCount: number; onChange: (page: number) => void }) {
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])).filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right)

  return <nav className="flex items-center justify-center gap-[7px] pt-6" aria-label="行动图分页">
    <button className="grid size-8 place-items-center rounded-md border border-line bg-surface text-muted hover:border-signal hover:text-signal" type="button" aria-label="上一页" title="上一页" disabled={currentPage === 1} onClick={() => onChange(currentPage - 1)}><ArrowLeft size={15} /></button>
    <div className="flex items-center gap-[7px]">{pageNumbers.map((pageNumber, index) => <span className="flex items-center gap-[7px]" key={pageNumber}>{index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span className="text-[11px] text-muted">...</span>}<button className={`grid size-8 place-items-center rounded-md border border-line bg-surface text-[11px] font-bold text-muted hover:border-signal hover:text-signal ${pageNumber === currentPage ? 'border-signal bg-signal-soft text-signal' : ''}`} type="button" aria-label={`第 ${pageNumber} 页`} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => onChange(pageNumber)}>{pageNumber}</button></span>)}</div>
    <button className="grid size-8 place-items-center rounded-md border border-line bg-surface text-muted hover:border-signal hover:text-signal" type="button" aria-label="下一页" title="下一页" disabled={currentPage === pageCount} onClick={() => onChange(currentPage + 1)}><ArrowRight size={15} /></button>
  </nav>
}

function compareProjects(left: Project, right: Project, sort: ProjectSort) {
  if (sort === 'name-asc') return left.title.localeCompare(right.title, 'zh-CN')
  const field = sort === 'created-desc' ? 'createdAt' : 'updatedAt'
  return new Date(right[field]).getTime() - new Date(left[field]).getTime()
}
