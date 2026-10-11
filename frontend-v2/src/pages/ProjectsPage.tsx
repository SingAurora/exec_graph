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

  return <section className="projects-page">
    <div className="projects-page-actions"><button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} />回到首页</button><button ref={createProjectButtonRef} className="primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={16} />创建项目</button></div>
    <nav className="projects-tabs" role="tablist" aria-label="项目类型">
      <button className={activeGroup === 'owned' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeGroup === 'owned'} onClick={() => changeGroup('owned')}>我创建的项目<span>{ownedProjects.length}</span></button>
      <button className={activeGroup === 'joined' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeGroup === 'joined'} onClick={() => changeGroup('joined')}>我参与的项目<span>{joinedProjects.length}</span></button>
    </nav>
    <div className="projects-toolbar">
      <label className="project-search"><span className="sr-only">搜索项目</span><Search size={16} /><input type="search" value={keyword} placeholder="搜索项目名称或描述" onChange={(event) => changeKeyword(event.target.value)} />{keyword && <button type="button" aria-label="清除搜索" title="清除搜索" onClick={() => changeKeyword('')}><X size={15} /></button>}</label>
      <div className="project-sort"><ArrowUpDown size={15} /><Select ariaLabel="项目排序" value={sort} onValueChange={(value) => changeSort(value as ProjectSort)} options={[{ value: 'updated-desc', label: '最近更新' }, { value: 'created-desc', label: '最近创建' }, { value: 'name-asc', label: '项目名称' }]} /></div>
    </div>
    <div className="projects-result-meta"><span>共 {filteredProjects.length} 个项目</span><span>{activeGroup === 'owned' ? '我创建的项目' : '我参与的项目'}</span></div>
    <ProjectList projects={pageProjects} topics={topics} plans={plans} completions={completions} onOpenProject={onOpenProject} emptyMessage={normalizedKeyword ? '没有找到相关项目。' : '暂无项目。'} dateField={sort === 'created-desc' ? 'createdAt' : 'updatedAt'} />
    {filteredProjects.length > 0 && <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setPage} />}
    {showCreateDialog && <CreateProjectDialog returnFocusRef={createProjectButtonRef} onClose={() => setShowCreateDialog(false)} onCreate={onCreateProject} />}
  </section>
}

function ProjectList({ projects, topics, plans, completions, onOpenProject, emptyMessage, dateField }: Pick<ProjectsPageProps, 'projects' | 'topics' | 'plans' | 'completions' | 'onOpenProject'> & { emptyMessage: string; dateField: 'createdAt' | 'updatedAt' }) {
  return <div className="all-projects-list">{projects.map((project) => {
    const topicIds = new Set(topics.filter((topic) => topic.projectId === project.id).map((topic) => topic.id))
    const projectPlans = plans.filter((plan) => topicIds.has(plan.topicId))
    const projectCompletions = completions.filter((completion) => topicIds.has(completion.topicId))
    const activeCount = projectPlans.filter((plan) => plan.status === 'active').length
    return <button type="button" onClick={() => onOpenProject(project.id)} key={project.id}><span className="all-project-icon"><FolderKanban size={19} /></span><span className="all-project-copy"><strong>{project.title}</strong><small>{project.description}</small><span>{activeCount} 项进行中 · {projectPlans.length} 项计划 · {projectCompletions.length} 条完成</span></span><span className="all-project-time">{dateField === 'createdAt' ? '创建' : '更新'} {formatDateTime(project[dateField])}<ArrowRight size={16} /></span></button>
  })}{!projects.length && <p className="empty-state">{emptyMessage}</p>}</div>
}

function Pagination({ currentPage, pageCount, onChange }: { currentPage: number; pageCount: number; onChange: (page: number) => void }) {
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])).filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right)

  return <nav className="projects-pagination" aria-label="项目分页">
    <button type="button" aria-label="上一页" title="上一页" disabled={currentPage === 1} onClick={() => onChange(currentPage - 1)}><ArrowLeft size={15} /></button>
    <div>{pageNumbers.map((pageNumber, index) => <span className="page-number-wrap" key={pageNumber}>{index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span className="page-ellipsis">...</span>}<button className={pageNumber === currentPage ? 'is-active' : ''} type="button" aria-label={`第 ${pageNumber} 页`} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => onChange(pageNumber)}>{pageNumber}</button></span>)}</div>
    <button type="button" aria-label="下一页" title="下一页" disabled={currentPage === pageCount} onClick={() => onChange(currentPage + 1)}><ArrowRight size={15} /></button>
  </nav>
}

function compareProjects(left: Project, right: Project, sort: ProjectSort) {
  if (sort === 'name-asc') return left.title.localeCompare(right.title, 'zh-CN')
  const field = sort === 'created-desc' ? 'createdAt' : 'updatedAt'
  return new Date(right[field]).getTime() - new Date(left[field]).getTime()
}
