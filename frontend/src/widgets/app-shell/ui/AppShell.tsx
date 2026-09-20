import { Archive, ArrowLeft, ChevronDown, ChevronRight, Compass, Eye, GitBranch, LayoutDashboard, LockKeyhole, LogOut, Moon, Plus, Settings2, SquareArrowOutUpRight, Sun, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { currentContractIDs, isAcceptedRecord, isReviewInProgress, needsReviewDecision } from '@/entities/execution-node/model/selectors'
import { applyTheme, type ThemeMode } from '@/shared/lib/theme'
import { useWorkspaceStore } from '@/features/workspace/model/useWorkspaceStore'
import type { Actor } from '@/entities/account/model/types'
import type { CompletionRecord, ExecutionBranch, ExecutionContract } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import type { RefObject } from 'react'

type FloatingPosition = {
  left: number
  bottom: number
}

function workspaceLabel(pathname: string) {
  if (pathname === '/') return '工作总览'
  if (pathname.startsWith('/explore')) return '探索'
  if (pathname.startsWith('/u/')) return '开发者'
  if (pathname === '/projects/new') return '新建项目'
  if (pathname.startsWith('/me')) return '公开主页'
  if (pathname.startsWith('/settings')) return '个人设置'
  if (pathname.startsWith('/smart-contracts')) return '智能合约'
  return '我的项目'
}

function backNavigation(pathname: string, contracts: ExecutionContract[]) {
  if (pathname.startsWith('/explore/projects/') || pathname.startsWith('/u/')) return { to: '/explore', label: '返回探索' }
  if (pathname.startsWith('/smart-contracts')) return { to: '/', label: '返回我的项目' }
  if (pathname.startsWith('/projects/')) return { to: '/', label: '返回我的项目' }

  const contractUuid = pathname.match(/^\/(?:contracts|nodes)\/([^/]+)/)?.[1]
  const contract = contracts.find((item) => item.uuid === contractUuid)
  return contract ? { to: `/projects/${contract.projectUuid}`, label: '返回项目' } : undefined
}

function resolveActiveProjectId(pathname: string, projects: Project[], contracts: ExecutionContract[]) {
  const projectUuid = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  if (projectUuid) return projectUuid

  const contractUuid = pathname.match(/^\/(?:contracts|nodes)\/([^/]+)/)?.[1]
  const contract = contracts.find((item) => item.uuid === contractUuid)
  if (contract) return contract.projectUuid

  return undefined
}

type ProjectStatus = {
  label: string
  dotClassName: string
}

function projectStatus(project: Project, contracts: ExecutionContract[], branches: ExecutionBranch[]): ProjectStatus {
  if (project.archivedAt) return { label: '只读项目', dotClassName: 'bg-graphite/45' }

  const currentIds = currentContractIDs([project], branches)
  const currentContracts = contracts.filter(
    (contract) => contract.projectUuid === project.uuid && currentIds.has(contract.uuid) && !contract.completionRecordUuid,
  )

  if (currentContracts.length > 1) return { label: `${currentContracts.length} 条路径待处理`, dotClassName: 'bg-signal' }
  const currentContract = currentContracts[0]
  if (!currentContract) return { label: '可以开始下一项', dotClassName: 'bg-graphite/35' }
  if (needsReviewDecision(currentContract)) {
    return { label: '待确认 AI 结果', dotClassName: 'bg-moss' }
  }
  if (isReviewInProgress(currentContract)) {
    return { label: '智能合约审核中', dotClassName: 'bg-signal' }
  }
  return { label: '待推进', dotClassName: 'bg-signal' }
}

function avatarInitials(actor?: Actor) {
  return actor?.handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function AvatarMark({ actor, className = 'size-9' }: { actor?: Actor; className?: string }) {
  return actor?.avatarUrl ? (
    <img src={actor.avatarUrl} alt="" className={`${className} rounded-full border border-rail object-cover`} />
  ) : (
    <span className={`grid ${className} place-items-center rounded-full bg-inverse font-mono text-[11px] font-semibold text-white`}>
      {avatarInitials(actor)}
    </span>
  )
}

function ProjectRailItem({ project, active, contracts, branches }: { project: Project; active: boolean; contracts: ExecutionContract[]; branches: ExecutionBranch[] }) {
  const status = projectStatus(project, contracts, branches)
  const visibilityIcon = project.visibility === 'public' ? <Eye size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />

  return (
    <Link
      to={`/projects/${project.uuid}`}
      className={[
        'group flex min-w-0 items-center gap-2 rounded-md px-3 py-2.5 transition-colors focus:outline-none focus-visible:shadow-focusline',
        active ? 'bg-signal/10 text-signal' : 'text-graphite hover:bg-shell/65 hover:text-ink',
      ].join(' ')}
    >
      <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-signal' : status.dotClassName}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{project.title}</span>
          <span className="shrink-0 opacity-70">{visibilityIcon}</span>
        </span>
        <span className={`mt-0.5 block truncate text-[11px] leading-4 ${active ? 'text-signal/70' : 'text-graphite/75'}`}>{status.label}</span>
      </span>
      <ChevronRight size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${active ? 'text-signal/70' : 'text-graphite/55'}`} aria-hidden="true" />
    </Link>
  )
}

function MiniActivityHeatmap({ records }: { records: CompletionRecord[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 56 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (55 - index))
    return date
  })
  const counts = new Map<string, number>()
  records.forEach((record) => {
    const date = new Date(record.createdAt)
    if (!Number.isNaN(date.getTime())) counts.set(dateKey(date), (counts.get(dateKey(date)) ?? 0) + 1)
  })
  const highest = Math.max(...counts.values(), 0)

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" aria-label="最近 8 周活跃热力">
      {days.map((date) => {
        const count = counts.get(dateKey(date)) ?? 0
        const level = count === 0 || highest === 0 ? 0 : Math.max(1, Math.ceil((count / highest) * 4))
        const className = ['bg-rail/45', 'bg-signal/20', 'bg-signal/45', 'bg-signal/70', 'bg-moss'][level]
        return <span key={dateKey(date)} title={`${date.toLocaleDateString('zh-CN')}：${count} 条锁定`} className={`size-2.5 rounded-[2px] ${className}`} />
      })}
    </div>
  )
}

function ProfileCard({ actor, profileHref, publicProjectCount, lockedRecordCount, activeDayCount, currentProject, currentProjectStatus, currentProjectRecordCount, currentProjectBranchCount, activityRecords, onClose, position, cardRef }: { actor?: Actor; profileHref: string; publicProjectCount: number; lockedRecordCount: number; activeDayCount: number; currentProject?: Project; currentProjectStatus?: ProjectStatus; currentProjectRecordCount: number; currentProjectBranchCount: number; activityRecords: CompletionRecord[]; onClose: () => void; position: FloatingPosition; cardRef: RefObject<HTMLDivElement | null> }) {
  const backgroundStyle = actor?.profileBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.34)),url(${JSON.stringify(actor.profileBackgroundUrl)})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }
    : undefined

  return (
    <div ref={cardRef} style={{ left: position.left, bottom: position.bottom }} className="fixed z-[80] w-[328px] overflow-hidden rounded-lg border border-rail bg-surface shadow-xl shadow-ink/10">
      <div style={backgroundStyle} className="h-[104px] bg-[radial-gradient(circle_at_20%_15%,rgba(22,119,255,0.55),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(46,139,87,0.38),transparent_28%),linear-gradient(135deg,rgb(var(--color-inverse)),rgb(var(--color-signal)))]" />
      <div className="px-5 pb-5">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <AvatarMark actor={actor} className="size-20 border-4 border-surface" />
          <Link to={profileHref} onClick={onClose} aria-label="打开公开主页" title="打开公开主页" className="grid size-10 place-items-center rounded-md border border-rail bg-paper text-graphite transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline">
            <SquareArrowOutUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 min-w-0">
          <div className="truncate text-lg font-semibold text-ink">{actor?.name ?? '你'}</div>
          <div className="mt-1 truncate font-mono text-xs font-medium text-graphite">{actor?.handle ?? '@you'}</div>
          {actor?.bio ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-graphite">{actor.bio}</p> : null}
        </div>

        <div className="mt-4 grid grid-cols-3 border-y border-rail">
          <ProfileCardFact label="公开项目" value={publicProjectCount} />
          <ProfileCardFact label="公开成果" value={lockedRecordCount} />
          <ProfileCardFact label="活跃天数" value={activeDayCount} />
        </div>

        <div className="mt-4 rounded-md border border-rail bg-paper/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase text-graphite">Recent locks</span>
            <span className="text-[11px] font-semibold text-graphite">8 weeks</span>
          </div>
          <MiniActivityHeatmap records={activityRecords} />
        </div>

        {currentProject ? (
          <Link to={`/projects/${currentProject.uuid}`} onClick={onClose} className="mt-3 block rounded-md border border-rail bg-paper/70 p-3 transition hover:border-signal/45 hover:bg-shell focus:outline-none focus-visible:shadow-focusline">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">{currentProject.title}</span>
              <span className={`size-2 shrink-0 rounded-full ${currentProjectStatus?.dotClassName ?? 'bg-graphite/35'}`} aria-hidden="true" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-graphite">
              <span>{currentProjectStatus?.label ?? '项目待推进'}</span>
              <span>{currentProjectRecordCount} 成果</span>
              <span className="inline-flex items-center gap-1"><GitBranch size={12} aria-hidden="true" />{Math.max(currentProjectBranchCount, 1)} 路径</span>
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function ProfileCardFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3 text-center first:pl-0 last:pr-0">
      <div className="font-display text-lg font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 whitespace-nowrap text-[10px] font-semibold text-graphite">{label}</div>
    </div>
  )
}

function SidebarIdentity({ actor, profileHref, publicProjectCount, lockedRecordCount, activeDayCount, currentProject, currentProjectStatus, currentProjectRecordCount, currentProjectBranchCount, activityRecords }: { actor?: Actor; profileHref: string; publicProjectCount: number; lockedRecordCount: number; activeDayCount: number; currentProject?: Project; currentProjectStatus?: ProjectStatus; currentProjectRecordCount: number; currentProjectBranchCount: number; activityRecords: CompletionRecord[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<FloatingPosition>({ left: 20, bottom: 92 })
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cardWidth = 328
    const viewportGap = 12
    setPosition({
      left: Math.min(Math.max(viewportGap, rect.left), window.innerWidth - cardWidth - viewportGap),
      bottom: Math.max(viewportGap, window.innerHeight - rect.top + viewportGap),
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || cardRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    updatePosition()
    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  return (
    <div className="px-3 pb-3">
      <button ref={triggerRef} type="button" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen} className="flex w-full min-w-0 items-center gap-3 rounded-md px-0 py-1 text-left focus:outline-none focus-visible:shadow-focusline">
        <AvatarMark actor={actor} className="size-10" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{actor?.name ?? '你'}</span>
          <span className="block truncate text-xs text-graphite">{actor?.handle ?? '@you'}</span>
        </span>
        <ChevronDown size={15} className={`ml-auto shrink-0 text-graphite transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen ? createPortal(<ProfileCard actor={actor} profileHref={profileHref} publicProjectCount={publicProjectCount} lockedRecordCount={lockedRecordCount} activeDayCount={activeDayCount} currentProject={currentProject} currentProjectStatus={currentProjectStatus} currentProjectRecordCount={currentProjectRecordCount} currentProjectBranchCount={currentProjectBranchCount} activityRecords={activityRecords} onClose={() => setIsOpen(false)} position={position} cardRef={cardRef} />, document.body) : null}
    </div>
  )
}

function MobileProjectMenu({ projects, activeProjectId, contracts, branches, profileHref }: { projects: Project[]; activeProjectId?: string; contracts: ExecutionContract[]; branches: ExecutionBranch[]; profileHref: string }) {
  const activeProject = projects.find((project) => project.uuid === activeProjectId)

  return (
    <details className="relative min-w-0 lg:hidden">
      <summary className="flex max-w-[190px] cursor-pointer list-none items-center gap-1 rounded-md px-2 py-2 text-sm font-semibold text-ink marker:hidden focus:outline-none focus-visible:shadow-focusline">
        <span className="truncate">{activeProject?.title ?? '我的项目'}</span>
        <ChevronDown size={15} className="shrink-0 text-graphite" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-rail bg-shell p-2 shadow-lg">
        <Link to="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-shell/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><LayoutDashboard size={16} aria-hidden="true" />工作总览</Link>
        <Link to="/explore" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-shell/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Compass size={16} aria-hidden="true" />探索</Link>
        <div className="px-2 py-2 font-mono text-[11px] font-semibold uppercase text-signal">我的项目</div>
        <div className="space-y-1">
          {projects.filter((project) => !project.archivedAt).map((project) => (
            <ProjectRailItem key={project.uuid} project={project} active={project.uuid === activeProjectId} contracts={contracts} branches={branches} />
          ))}
        </div>
        <div className="mt-2 border-t border-rail pt-2">
          <Link to="/projects/new" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-shell/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Plus size={16} aria-hidden="true" />新建项目</Link>
          <Link to={profileHref} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-shell/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><UserRound size={16} aria-hidden="true" />公开主页</Link>
          <Link to="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-graphite hover:bg-shell/65 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Settings2 size={16} aria-hidden="true" />个人设置</Link>
        </div>
      </div>
    </details>
  )
}

export function AppShell() {
  const location = useLocation()
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const signOut = useWorkspaceStore((state) => state.signOut)
  const refreshWorkspace = useWorkspaceStore((state) => state.refreshWorkspace)
  const projects = useWorkspaceStore((state) => state.projects)
  const contracts = useWorkspaceStore((state) => state.contracts)
  const branches = useWorkspaceStore((state) => state.branches)
  const actors = useWorkspaceStore((state) => state.actors)
  const currentActorId = useWorkspaceStore((state) => state.currentActorId)
  const currentActor = actors.find((actor) => actor.id === currentActorId)
  const profileHref = currentActor?.customProfileEnabled ? '/me?tab=custom' : '/me'
  const completionRecords = useWorkspaceStore((state) => state.completionRecords)
  const activeProjectId = resolveActiveProjectId(location.pathname, projects, contracts)
  const activeProject = projects.find((project) => project.uuid === activeProjectId)
  const currentWorkspace = activeProject && location.pathname !== '/' ? activeProject.title : workspaceLabel(location.pathname)
  const back = backNavigation(location.pathname, contracts)
  const activeProjects = projects.filter((project) => !project.archivedAt)
  const archivedProjects = projects.filter((project) => project.archivedAt)
  const nextTheme = themeMode === 'light' ? 'dark' : 'light'
  const ThemeIcon = nextTheme === 'dark' ? Moon : Sun
  const publicProjects = projects.filter((project) => project.visibility === 'public')
  const publicProjectIds = new Set(publicProjects.map((project) => project.uuid))
  const publicCompleted = completionRecords
    .filter((record) => publicProjectIds.has(record.projectUuid))
    .filter(isAcceptedRecord)
    .filter((record) => contracts.find((contract) => contract.uuid === record.closingContractUuid)?.actorUserId === currentActorId)
  const activeDays = new Set(publicCompleted.map((record) => new Date(record.createdAt).toDateString())).size

  // Avatar URLs are signed by COS. Refresh persisted workspace data when an existing session restores.
  useEffect(() => {
    void refreshWorkspace()
  }, [refreshWorkspace])

  const toggleTheme = () => {
    setThemeMode(nextTheme)
    applyTheme(nextTheme)
  }

  const cardProject = activeProject ?? activeProjects.find((project) => project.currentContractUuid) ?? activeProjects[0]
  const cardProjectStatus = cardProject ? projectStatus(cardProject, contracts, branches) : undefined
  const cardProjectRecordCount = cardProject ? completionRecords.filter((record) => record.projectUuid === cardProject.uuid && isAcceptedRecord(record)).length : 0
  const cardProjectBranchCount = cardProject ? branches.filter((branch) => branch.projectUuid === cardProject.uuid).length : 0

  return (
    <div className="h-[100dvh] overflow-hidden bg-paper text-ink">
      <div className="flex h-full w-full">
        <aside className="hidden h-full w-[280px] shrink-0 flex-col overflow-y-auto border-r border-rail bg-shell px-5 py-6 lg:flex">
          <NavLink to="/" className="group block rounded-md focus:outline-none focus-visible:shadow-focusline">
            <BrandLogo />
          </NavLink>

          <div className="mt-10 flex items-center justify-between gap-3 px-3">
            <span className="font-mono text-xs font-semibold uppercase text-signal">我的项目</span>
            <Link
              to="/projects/new"
              aria-label="新建项目"
              title="新建项目"
              className="grid size-8 place-items-center rounded-md text-graphite transition hover:bg-shell/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"
            >
              <Plus size={17} aria-hidden="true" />
            </Link>
          </div>
          <nav className="mt-3 space-y-1" aria-label="我的项目">
            {activeProjects.map((project) => <ProjectRailItem key={project.uuid} project={project} active={project.uuid === activeProjectId} contracts={contracts} branches={branches} />)}
          </nav>

          {archivedProjects.length > 0 ? (
            <details className="mt-5 border-t border-rail pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-graphite marker:hidden focus:outline-none focus-visible:shadow-focusline"><Archive size={14} aria-hidden="true" />已归档项目</summary>
              <div className="mt-2 space-y-1">{archivedProjects.map((project) => <ProjectRailItem key={project.uuid} project={project} active={project.uuid === activeProjectId} contracts={contracts} branches={branches} />)}</div>
            </details>
          ) : null}

          <div className="mt-auto pt-4">
            <SidebarIdentity actor={currentActor} profileHref={profileHref} publicProjectCount={publicProjects.length} lockedRecordCount={publicCompleted.length} activeDayCount={activeDays} currentProject={cardProject} currentProjectStatus={cardProjectStatus} currentProjectRecordCount={cardProjectRecordCount} currentProjectBranchCount={cardProjectBranchCount} activityRecords={publicCompleted} />
            <div className="mx-3 h-px bg-rail/80" aria-hidden="true" />
            <div className="flex h-11 items-center gap-1 px-3">
              <NavLink to="/settings" aria-label="个人设置" title="个人设置" className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-shell/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Settings2 size={17} aria-hidden="true" /></NavLink>
              <button type="button" onClick={toggleTheme} aria-label={`切换至${nextTheme === 'dark' ? '暗色' : '亮色'}主题`} title={`切换至${nextTheme === 'dark' ? '暗色' : '亮色'}主题`} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-shell/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><ThemeIcon size={16} aria-hidden="true" /></button>
              <button type="button" onClick={signOut} aria-label="退出登录" title="退出登录" className="ml-auto grid size-9 place-items-center rounded-md text-graphite transition hover:bg-clay/10 hover:text-clay focus:outline-none focus-visible:shadow-focusline"><LogOut size={16} aria-hidden="true" /></button>
            </div>
          </div>
        </aside>

        <div className="flex h-full min-w-0 min-h-0 flex-1 flex-col">
          <header className="z-20 shrink-0 border-b border-rail bg-paper/95 backdrop-blur">
            <div className="hidden h-16 items-center justify-between px-10 lg:flex">
              <div className="flex min-w-0 items-center gap-3">
                {back ? <Link to={back.to} aria-label={back.label} title={back.label} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-shell/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><ArrowLeft size={18} aria-hidden="true" /></Link> : null}
                <div className="truncate font-mono text-xs font-semibold uppercase text-signal">{currentWorkspace}</div>
              </div>
              <div className="flex items-center gap-1">
                <NavLink to="/" className={({ isActive }) => `inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${isActive ? 'bg-shell text-ink' : 'text-graphite hover:bg-shell hover:text-ink'}`}><LayoutDashboard size={16} aria-hidden="true" />工作总览</NavLink>
                <NavLink to="/explore" className={({ isActive }) => `inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${isActive ? 'bg-shell text-ink' : 'text-graphite hover:bg-shell hover:text-ink'}`}><Compass size={16} aria-hidden="true" />探索</NavLink>
                <Link to="/projects/new" className="ml-2 inline-flex h-9 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"><Plus size={16} aria-hidden="true" />新建项目</Link>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 lg:hidden">
              <div className="flex min-w-0 items-center gap-1">
                {back ? <Link to={back.to} aria-label={back.label} title={back.label} className="grid size-10 shrink-0 place-items-center rounded-md text-graphite transition hover:bg-shell/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"><ArrowLeft size={19} aria-hidden="true" /></Link> : <NavLink to="/" aria-label="ExecG" className="grid size-10 shrink-0 place-items-center rounded-md focus:outline-none focus-visible:shadow-focusline"><BrandLogo compact className="size-8" /></NavLink>}
                <MobileProjectMenu projects={projects} activeProjectId={activeProjectId} contracts={contracts} branches={branches} profileHref={profileHref} />
              </div>
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto w-full max-w-[1280px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
