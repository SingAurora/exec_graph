import { Archive, ArrowRight, Bot, CheckCircle2, Eye, FileCheck2, FolderKanban, FolderPlus, type LucideIcon } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { SectionHeader } from '../components/SectionHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useExecStore } from '../store/useExecStore'
import type { ExecutionBranch, ExecutionContract, Project } from '../types'

type QueueKind = 'reviewing' | 'awaiting' | 'progress'

type QueueCopy = {
  title: string
  eyebrow: string
  empty: string
  icon: LucideIcon
  accentClassName: string
  railClassName: string
}

const queueCopy: Record<QueueKind, QueueCopy> = {
  awaiting: { title: '等待你的确认', eyebrow: 'Your decision', empty: '暂无等待确认的审核结果。', icon: CheckCircle2, accentClassName: 'text-moss', railClassName: 'border-moss text-moss' },
  reviewing: { title: 'AI 正在审核', eyebrow: 'AI review', empty: '暂无正在审核的节点。', icon: Bot, accentClassName: 'text-amber', railClassName: 'border-amber text-amber' },
  progress: { title: '等待推进', eyebrow: 'Next action', empty: '暂无等待推进的节点。', icon: FileCheck2, accentClassName: 'text-signal', railClassName: 'border-signal text-signal' },
}

function currentNodeIDs(projects: Project[], branches: ExecutionBranch[]) {
  return new Set([
    ...projects.flatMap((project) => project.currentContractId ?? ''),
    ...branches.flatMap((branch) => branch.currentContractId ?? ''),
  ])
}

function actionLabel(contract: ExecutionContract) {
  if (contract.stage === 'verified') return '确认 AI 结果'
  if (contract.stage === 'needs_supplement') return '处理缺口'
  if (contract.completionClaim && !contract.aiReview) return '查看提交'
  return '提交推进结果'
}

export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const projects = useExecStore((state) => state.projects)
  const contracts = useExecStore((state) => state.contracts)
  const branches = useExecStore((state) => state.branches)
  const completionRecords = useExecStore((state) => state.completionRecords)

  if (searchParams.get('new') === 'project') return <Navigate to="/projects/new" replace />

  const activeProjects = projects.filter((project) => !project.archivedAt)
  const currentIDs = currentNodeIDs(activeProjects, branches.filter((branch) => activeProjects.some((project) => project.id === branch.projectId)))
  const currentNodes = contracts
    .filter((contract) => currentIDs.has(contract.id) && !contract.completionRecordId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const reviewing = currentNodes.filter((contract) => contract.stage === 'frozen' && Boolean(contract.completionClaim) && !contract.aiReview)
  const awaiting = currentNodes.filter((contract) => contract.stage === 'verified' || contract.stage === 'needs_supplement')
  const progress = currentNodes.filter((contract) => contract.stage === 'frozen' && !contract.completionClaim)
  const projectByID = new Map(projects.map((project) => [project.id, project]))

  return (
    <div className="space-y-9">
      <section className="border-b border-rail pb-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="font-mono text-xs font-semibold uppercase text-signal">工作总览</div>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">现在该处理什么</h1>
          </div>
          <Link to="/projects/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline">
            <FolderPlus size={16} aria-hidden="true" />
            新建项目
          </Link>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="global-queue-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="需要处理" title="当前行动" />
          <span className="text-sm font-semibold text-graphite">{currentNodes.length} 个当前节点</span>
        </div>
        <div className="border-y border-rail bg-surface">
          {currentNodes.length > 0 ? <>
            <NodeQueue kind="awaiting" contracts={awaiting} projects={projectByID} />
            <NodeQueue kind="reviewing" contracts={reviewing} projects={projectByID} />
            <NodeQueue kind="progress" contracts={progress} projects={projectByID} />
          </> : <p className="px-5 py-4 text-sm text-graphite">暂时没有待处理行动。新建项目后，从第一项推进开始。</p>}
        </div>
      </section>

      <section className="space-y-4 border-t border-rail pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader eyebrow="所有项目" title="我的项目" />
          <span className="text-sm font-semibold text-graphite">{completionRecords.filter((record) => record.recordKind === 'accepted').length} 条已验收成果</span>
        </div>
        <div className="border-y border-rail bg-surface">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </section>
    </div>
  )
}

function NodeQueue({ kind, contracts, projects }: { kind: QueueKind; contracts: ExecutionContract[]; projects: Map<string, Project> }) {
  const copy = queueCopy[kind]
  const Icon = copy.icon
  return (
    <section className={`min-w-0 border-b border-rail last:border-b-0 ${contracts.length === 0 ? 'hidden' : ''}`} aria-label={copy.title}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className={`shrink-0 ${copy.accentClassName}`} aria-hidden="true" />
          <div className="min-w-0">
            <div className={`font-mono text-[11px] font-semibold uppercase ${copy.accentClassName}`}>{copy.eyebrow}</div>
            <h2 className="mt-1 truncate text-base font-semibold text-ink">{copy.title}</h2>
          </div>
        </div>
        <span className="font-mono text-sm font-semibold text-graphite">{contracts.length}</span>
      </div>
      <div className="divide-y divide-rail">
        {contracts.length > 0 ? contracts.map((contract) => <QueueNode key={contract.id} contract={contract} project={projects.get(contract.projectId)} railClassName={copy.railClassName} />) : <p className="px-5 pb-5 text-sm text-graphite">{copy.empty}</p>}
      </div>
    </section>
  )
}

function QueueNode({ contract, project, railClassName }: { contract: ExecutionContract; project?: Project; railClassName: string }) {
  return (
    <Link to={`/contracts/${contract.id}?tab=completion`} className="group flex gap-4 px-5 py-4 transition hover:bg-shell/45 focus:outline-none focus-visible:shadow-focusline">
      <div className={`flex w-3 shrink-0 justify-center border-l-2 ${railClassName}`}><span className="-mt-0.5 size-2.5 rounded-full border-2 border-surface bg-current" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-graphite">{project?.title ?? '项目'}</div>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-ink group-hover:text-signal">{contract.title}</h3>
          </div>
          <StatusBadge stage={contract.stage} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-graphite">
          <span className="truncate">{actionLabel(contract)}</span>
          <ArrowRight size={16} className="shrink-0 text-signal transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const contracts = useExecStore((state) => state.contracts)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const branches = useExecStore((state) => state.branches)
  const projectContracts = contracts.filter((contract) => contract.projectId === project.id)
  const projectRecords = completionRecords.filter((record) => record.projectId === project.id && record.recordKind === 'accepted')
  const isArchived = Boolean(project.archivedAt)
  const currentContract = contracts.find((contract) => contract.id === project.currentContractId)
  const activeBranches = branches.filter((branch) => branch.projectId === project.id && branch.currentContractId)
  const currentContractIDs = new Set([project.currentContractId ?? '', ...activeBranches.map((branch) => branch.currentContractId ?? '')])
  const pendingContracts = projectContracts.filter((contract) => currentContractIDs.has(contract.id) && !contract.completionRecordId).length
  const branchStatus = activeBranches.length > 0 ? `${activeBranches.length} 条路径推进中` : '可以开始下一项推进'

  return (
    <Link to={`/projects/${project.id}`} className="group grid min-w-0 gap-4 border-b border-rail px-5 py-5 last:border-b-0 transition hover:bg-shell/45 focus:outline-none focus-visible:shadow-focusline lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-center">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold text-signal">{project.isDefault ? '默认项目' : '项目'}{project.visibility === 'public' ? <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden="true" />公开</span> : null}{isArchived ? <span className="inline-flex items-center gap-1 text-graphite"><Archive size={12} aria-hidden="true" />已归档</span> : null}</div>
          <h2 className="mt-2 text-lg font-semibold leading-6 text-ink">{project.title}</h2>
        </div>
        <FolderKanban size={18} className="shrink-0 text-signal" aria-hidden="true" />
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p>
      <div className="text-xs leading-5 text-graphite">
        <div className="font-semibold text-ink">{project.projectType === 'guided' ? '规则引导 · AI 动态出具行动合约' : '自主推进 · 平台基础规则'}</div>
        <div className="mt-1">{projectRecords.length} 条验收成果 · {pendingContracts} 个当前待处理节点</div>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
        <span className="truncate">{isArchived ? '项目已归档，只读' : currentContract ? `当前：${currentContract.title}` : branchStatus}</span>
        <ArrowRight size={17} className="shrink-0 text-signal transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  )
}
