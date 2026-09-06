import { Archive, ArrowRight, CheckCircle2, Eye, FileCheck2, FolderKanban, FolderPlus, GitBranchPlus, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ContractComposer } from '../components/ContractComposer'
import { SectionHeader } from '../components/SectionHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useExecStore } from '../store/useExecStore'
import type { ExecutionContract, Project } from '../types'

const currentAction = (contract: ExecutionContract) => {
  if (contract.nodeKind === 'task') return { label: '开始第一次推进', description: '任务起点已经建立，下一步从这里创建第一条推进节点。', icon: LockKeyhole }
  if (contract.stage === 'verified') return { label: '确认 AI 结果', description: 'AI 已通过审查，确认后节点会被锁定并生成记录。', icon: CheckCircle2 }
  if (contract.stage === 'needs_supplement') return { label: '处理 AI 结果', description: 'AI 未通过，可以生成补足节点，也可以带着结论锁定。', icon: GitBranchPlus }
  return { label: '提交推进结果', description: '完成一次推进后，节点会进入待确认 AI 结果。', icon: FileCheck2 }
}

export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const projects = useExecStore((state) => state.projects)
  const contracts = useExecStore((state) => state.contracts)
  const defaultProject = projects.find((project) => project.isDefault) ?? projects[0]
  const defaultCurrent = contracts.find((contract) => contract.id === defaultProject?.currentContractId)

  if (searchParams.get('new') === 'project') return <Navigate to="/projects/new" replace />

  return (
    <div className="space-y-10">
      <section className="border-b border-rail pb-7">
        <div className="font-mono text-xs font-semibold uppercase text-signal">我的项目</div>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink">一次只推进一个节点，完成按范围锁定。</h1>
      </section>

      {defaultProject ? (
        <section className="grid gap-7 border-b border-rail pb-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <DefaultProjectGuide project={defaultProject} />
          {defaultCurrent ? <CurrentActionCard contract={defaultCurrent} /> : <ContractComposer projectId={defaultProject.id} lockProject />}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader eyebrow="所有项目" title="我的项目" />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/smart-contracts"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rail bg-white/72 px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
            >
              <ShieldCheck size={16} aria-hidden="true" />
              管理智能合约
            </Link>
            <Link
              to="/projects/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rail bg-white/72 px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
            >
              <FolderPlus size={16} aria-hidden="true" />
              新建项目
            </Link>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  )
}

function DefaultProjectGuide({ project }: { project: Project }) {
  const smartContracts = useExecStore((state) => state.smartContracts)
  const activeRevision = project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId)
  const smartContract = smartContracts.find((item) => item.id === activeRevision?.smartContractId)

  return (
    <div>
      <div className="font-mono text-xs font-semibold uppercase text-signal">默认项目</div>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">{project.title}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-graphite">{project.description}</p>
      <div className="mt-6 border-y border-rail py-4">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
          <LockKeyhole size={15} aria-hidden="true" />
          当前项目智能合约
        </div>
        <div className="mt-2 text-sm font-semibold text-ink">{smartContract?.name}</div>
        <p className="mt-2 text-sm leading-6 text-graphite">{smartContract?.description}</p>
      </div>
      <Link
        className="mt-6 inline-flex h-10 items-center gap-2 text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
        to={`/projects/${project.id}`}
      >
        进入项目
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  )
}

function CurrentActionCard({ contract }: { contract: ExecutionContract }) {
  const action = currentAction(contract)
  const Icon = action.icon

  return (
    <Link
      to={`/contracts/${contract.id}`}
      className="group block border-l-2 border-ink bg-white/72 p-6 transition hover:bg-white focus:outline-none focus-visible:shadow-focusline"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
          <Icon size={16} aria-hidden="true" />
          当前要处理
        </div>
        <StatusBadge stage={contract.stage} />
      </div>
      <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-ink">{contract.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">{contract.verifiableGoal}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rail pt-4">
        <p className="text-sm leading-6 text-graphite">{action.description}</p>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">
          {action.label}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const contracts = useExecStore((state) => state.contracts)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const branches = useExecStore((state) => state.branches)
  const smartContracts = useExecStore((state) => state.smartContracts)
  const activeRevision = project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId)
  const smartContract = smartContracts.find((item) => item.id === activeRevision?.smartContractId)
  const projectContracts = contracts.filter((contract) => contract.projectId === project.id)
  const projectRecords = completionRecords.filter((record) => record.projectId === project.id)
  const isArchived = Boolean(project.archivedAt)
  const currentContract = contracts.find((contract) => contract.id === project.currentContractId)
  const activeBranches = branches.filter((branch) => branch.projectId === project.id && branch.currentContractId)
  const currentContractIds = new Set([project.currentContractId ?? '', ...activeBranches.map((branch) => branch.currentContractId ?? '')])
  const pendingContracts = projectContracts.filter((contract) => currentContractIds.has(contract.id) && !contract.completionRecordId && contract.nodeKind !== 'task').length
  const action = currentContract ? currentAction(currentContract) : undefined
  const branchStatus = activeBranches.length > 0 ? `${activeBranches.length} 条路径推进中` : '可从完成记录拆分路径'

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-md border border-rail bg-white/72 p-5 transition hover:-translate-y-0.5 hover:border-graphite/40 hover:bg-white focus:outline-none focus-visible:shadow-focusline"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold text-signal">{project.isDefault ? '默认项目' : '项目'}{project.visibility === 'public' ? <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden="true" />公开</span> : null}{isArchived ? <span className="inline-flex items-center gap-1 text-graphite"><Archive size={12} aria-hidden="true" />已归档</span> : null}</div>
          <h2 className="mt-2 text-lg font-semibold leading-6 text-ink">{project.title}</h2>
        </div>
        <FolderKanban size={18} className="shrink-0 text-signal" aria-hidden="true" />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p>
      <div className="mt-4 border-t border-rail pt-3 text-xs leading-5 text-graphite">
        <div className="font-semibold text-ink">{smartContract?.name}</div>
        <div className="mt-1">{projectRecords.length} 条完成记录 · {pendingContracts} 个当前待处理节点</div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-ink">
        <span className="truncate">{isArchived ? '项目已归档，只读' : activeBranches.length > 0 ? branchStatus : currentContract ? `当前：${currentContract.title}` : '可以开始下一项推进'}</span>
        <span className="shrink-0 text-signal">{isArchived ? '查看记录' : project.visibility === 'public' ? '查看分支' : action?.label ?? '开始'}</span>
      </div>
    </Link>
  )
}
