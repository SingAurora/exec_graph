import { Archive, ArrowLeft, ChevronDown, ChevronRight, Eye, LockKeyhole, LogOut, Plus, RotateCcw, Settings2, UserRound } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'
import type { Actor, ExecutionBranch, ExecutionContract, Project } from '../types'

function workspaceLabel(pathname: string) {
  if (pathname === '/projects/new') return '新建项目'
  if (pathname.startsWith('/me')) return '执行足迹'
  if (pathname.startsWith('/settings')) return '个人设置'
  if (pathname.startsWith('/smart-contracts')) return '智能合约'
  return '我的项目'
}

function backNavigation(pathname: string, contracts: ExecutionContract[]) {
  if (pathname.startsWith('/smart-contracts')) return { to: '/', label: '返回我的项目' }
  if (pathname.startsWith('/projects/')) return { to: '/', label: '返回我的项目' }

  const contractId = pathname.match(/^\/(?:contracts|nodes)\/([^/]+)/)?.[1]
  const contract = contracts.find((item) => item.id === contractId)
  return contract ? { to: `/projects/${contract.projectId}`, label: '返回项目' } : undefined
}

function resolveActiveProjectId(pathname: string, projects: Project[], contracts: ExecutionContract[]) {
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  if (projectId) return projectId

  const contractId = pathname.match(/^\/(?:contracts|nodes)\/([^/]+)/)?.[1]
  const contract = contracts.find((item) => item.id === contractId)
  if (contract) return contract.projectId

  return pathname === '/' ? projects.find((project) => project.isDefault)?.id : undefined
}

type ProjectStatus = {
  label: string
  dotClassName: string
}

function projectStatus(project: Project, contracts: ExecutionContract[], branches: ExecutionBranch[]): ProjectStatus {
  if (project.archivedAt) return { label: '只读项目', dotClassName: 'bg-graphite/45' }

  const currentIds = new Set([
    project.currentContractId ?? '',
    ...branches
      .filter((branch) => branch.projectId === project.id)
      .map((branch) => branch.currentContractId ?? ''),
  ])
  const currentContracts = contracts.filter(
    (contract) => contract.projectId === project.id && currentIds.has(contract.id) && !contract.completionRecordId,
  )

  if (currentContracts.length > 1) return { label: `${currentContracts.length} 条路径待处理`, dotClassName: 'bg-signal' }
  const currentContract = currentContracts[0]
  if (!currentContract) return { label: '可以开始下一项', dotClassName: 'bg-graphite/35' }
  if (currentContract.nodeKind === 'task') return { label: '任务起点已建立', dotClassName: 'bg-ink' }
  if (currentContract.stage === 'verified' || currentContract.stage === 'needs_supplement') {
    return { label: '待确认 AI 结果', dotClassName: 'bg-moss' }
  }
  if (currentContract.completionClaim && !currentContract.aiReview) {
    return { label: '智能合约审核中', dotClassName: 'bg-signal' }
  }
  return { label: '待推进', dotClassName: 'bg-signal' }
}

function avatarInitials(actor?: Actor) {
  return actor?.handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

function AvatarMark({ actor, className = 'size-9' }: { actor?: Actor; className?: string }) {
  return actor?.avatarUrl ? (
    <img src={actor.avatarUrl} alt="" className={`${className} rounded-full border border-rail object-cover`} />
  ) : (
    <span className={`grid ${className} place-items-center rounded-full bg-ink font-mono text-[11px] font-semibold text-paper`}>
      {avatarInitials(actor)}
    </span>
  )
}

function ProjectRailItem({ project, active, contracts, branches }: { project: Project; active: boolean; contracts: ExecutionContract[]; branches: ExecutionBranch[] }) {
  const status = projectStatus(project, contracts, branches)
  const visibilityIcon = project.visibility === 'public' ? <Eye size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />

  return (
    <Link
      to={`/projects/${project.id}`}
      className={[
        'group flex min-w-0 items-center gap-2 rounded-md px-3 py-2.5 transition-colors focus:outline-none focus-visible:shadow-focusline',
        active ? 'bg-ink text-paper' : 'text-graphite hover:bg-white/65 hover:text-ink',
      ].join(' ')}
    >
      <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-paper' : status.dotClassName}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{project.title}</span>
          <span className="shrink-0 opacity-70">{visibilityIcon}</span>
        </span>
        <span className={`mt-0.5 block truncate text-[11px] leading-4 ${active ? 'text-paper/70' : 'text-graphite/75'}`}>{project.isDefault ? '默认项目 · ' : ''}{status.label}</span>
      </span>
      <ChevronRight size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${active ? 'text-paper/70' : 'text-graphite/55'}`} aria-hidden="true" />
    </Link>
  )
}

function MobileProjectMenu({ projects, activeProjectId, contracts, branches }: { projects: Project[]; activeProjectId?: string; contracts: ExecutionContract[]; branches: ExecutionBranch[] }) {
  const activeProject = projects.find((project) => project.id === activeProjectId)

  return (
    <details className="relative min-w-0 lg:hidden">
      <summary className="flex max-w-[190px] cursor-pointer list-none items-center gap-1 rounded-md px-2 py-2 text-sm font-semibold text-ink marker:hidden focus:outline-none focus-visible:shadow-focusline">
        <span className="truncate">{activeProject?.title ?? '我的项目'}</span>
        <ChevronDown size={15} className="shrink-0 text-graphite" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-rail bg-[#efebe1] p-2 shadow-lg">
        <div className="px-2 py-2 font-mono text-[11px] font-semibold uppercase text-signal">我的项目</div>
        <div className="space-y-1">
          {projects.filter((project) => !project.archivedAt).map((project) => (
            <ProjectRailItem key={project.id} project={project} active={project.id === activeProjectId} contracts={contracts} branches={branches} />
          ))}
        </div>
        <div className="mt-2 border-t border-rail pt-2">
          <Link to="/projects/new" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-white/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Plus size={16} aria-hidden="true" />新建项目</Link>
          <Link to="/me" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-white/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><UserRound size={16} aria-hidden="true" />执行足迹</Link>
          <Link to="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-white/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Settings2 size={16} aria-hidden="true" />个人设置</Link>
        </div>
      </div>
    </details>
  )
}

export function AppShell() {
  const location = useLocation()
  const resetDemo = useExecStore((state) => state.resetDemo)
  const signOut = useExecStore((state) => state.signOut)
  const projects = useExecStore((state) => state.projects)
  const contracts = useExecStore((state) => state.contracts)
  const branches = useExecStore((state) => state.branches)
  const actors = useExecStore((state) => state.actors)
  const currentActorId = useExecStore((state) => state.currentActorId)
  const currentActor = actors.find((actor) => actor.id === currentActorId)
  const activeProjectId = resolveActiveProjectId(location.pathname, projects, contracts)
  const activeProject = projects.find((project) => project.id === activeProjectId)
  const currentWorkspace = activeProject && location.pathname !== '/' ? activeProject.title : workspaceLabel(location.pathname)
  const back = backNavigation(location.pathname, contracts)
  const activeProjects = projects.filter((project) => !project.archivedAt)
  const archivedProjects = projects.filter((project) => project.archivedAt)

  return (
    <div className="h-[100dvh] overflow-hidden bg-paper text-ink">
      <div className="mx-auto flex h-full w-full max-w-[1440px]">
        <aside className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-rail/80 bg-[#efebe1] px-5 py-6 lg:flex">
          <NavLink to="/" className="group block rounded-md focus:outline-none focus-visible:shadow-focusline">
            <div className="font-display text-3xl font-semibold leading-none">执行图谱</div>
            <div className="mt-2 text-sm leading-6 text-graphite">行为，验证，记录，推进</div>
          </NavLink>

          <div className="mt-10 flex items-center justify-between gap-3 px-3">
            <Link to="/" className="font-mono text-xs font-semibold uppercase text-signal focus:outline-none focus-visible:shadow-focusline">我的项目</Link>
            <Link
              to="/projects/new"
              aria-label="新建项目"
              title="新建项目"
              className="grid size-8 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"
            >
              <Plus size={17} aria-hidden="true" />
            </Link>
          </div>
          <nav className="mt-3 space-y-1" aria-label="我的项目">
            {activeProjects.map((project) => <ProjectRailItem key={project.id} project={project} active={project.id === activeProjectId} contracts={contracts} branches={branches} />)}
          </nav>

          {archivedProjects.length > 0 ? (
            <details className="mt-5 border-t border-rail pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-graphite marker:hidden focus:outline-none focus-visible:shadow-focusline"><Archive size={14} aria-hidden="true" />已归档项目</summary>
              <div className="mt-2 space-y-1">{archivedProjects.map((project) => <ProjectRailItem key={project.id} project={project} active={project.id === activeProjectId} contracts={contracts} branches={branches} />)}</div>
            </details>
          ) : null}

          <div className="mt-auto border-t border-rail pt-4">
            <NavLink to="/me" className="flex min-w-0 items-center gap-3 rounded-md px-3 py-2.5 transition hover:bg-white/65 focus:outline-none focus-visible:shadow-focusline">
              <AvatarMark actor={currentActor} />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{currentActor?.name ?? '你'}</span><span className="mt-0.5 block truncate text-xs text-graphite">{currentActor?.handle ?? '@you'}</span></span>
            </NavLink>
            <div className="mt-3 flex items-center gap-1 px-2">
              <NavLink to="/settings" aria-label="个人设置" title="个人设置" className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Settings2 size={17} aria-hidden="true" /></NavLink>
              <button type="button" onClick={resetDemo} aria-label="重置模拟数据" title="重置模拟数据" className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><RotateCcw size={16} aria-hidden="true" /></button>
              <button type="button" onClick={signOut} aria-label="退出登录" title="退出登录" className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><LogOut size={16} aria-hidden="true" /></button>
            </div>
          </div>
        </aside>

        <div className="flex h-full min-w-0 min-h-0 flex-1 flex-col">
          <header className="z-20 shrink-0 border-b border-rail bg-paper/92 backdrop-blur">
            <div className="hidden h-16 items-center justify-between px-10 lg:flex">
              <div className="flex min-w-0 items-center gap-3">
                {back ? <Link to={back.to} aria-label={back.label} title={back.label} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><ArrowLeft size={18} aria-hidden="true" /></Link> : null}
                <div className="truncate font-mono text-xs font-semibold uppercase text-signal">{currentWorkspace}</div>
              </div>
              <NavLink to="/me" aria-label="执行足迹" title="执行足迹" className="focus:outline-none focus-visible:shadow-focusline"><AvatarMark actor={currentActor} className="size-8" /></NavLink>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 lg:hidden">
              <div className="flex min-w-0 items-center gap-1">
                {back ? <Link to={back.to} aria-label={back.label} title={back.label} className="grid size-10 shrink-0 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><ArrowLeft size={19} aria-hidden="true" /></Link> : <NavLink to="/" className="shrink-0 px-2 font-display text-2xl font-semibold focus:outline-none focus-visible:shadow-focusline">执行图谱</NavLink>}
                <MobileProjectMenu projects={projects} activeProjectId={activeProjectId} contracts={contracts} branches={branches} />
              </div>
              <NavLink to="/me" aria-label="执行足迹" title="执行足迹" className="shrink-0 focus:outline-none focus-visible:shadow-focusline"><AvatarMark actor={currentActor} className="size-9" /></NavLink>
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
