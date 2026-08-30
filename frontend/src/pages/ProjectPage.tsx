import { Archive, ArrowRight, Bot, CheckCircle2, Eye, FileCheck2, GitBranchPlus, GitFork, GitMerge, LockKeyhole, Settings2, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ContractComposer } from '../components/ContractComposer'
import { NodeCard } from '../components/NodeCard'
import { ProjectGraph } from '../components/ProjectGraph'
import { SectionHeader } from '../components/SectionHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useExecStore } from '../store/useExecStore'
import type { CompletionRecord, ExecutionBranch, ExecutionContract, Project } from '../types'

type CurrentNodeCopy = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  actionLabel: string
}

const currentNodeCopy = (contract: ExecutionContract): CurrentNodeCopy => {
  if (contract.stage === 'verified') {
    return {
      icon: CheckCircle2,
      eyebrow: '待确认 AI 结果',
      title: '确认 AI 审查结果',
      description: 'AI 已通过审查。确认结果后，节点会被锁定并生成一条记录。',
      actionLabel: '确认 AI 结果',
    }
  }
  if (contract.stage === 'needs_supplement') {
    return {
      icon: GitBranchPlus,
      eyebrow: '待确认 AI 结果',
      title: '处理 AI 审查结果',
      description: 'AI 未通过。你可以生成补足节点继续推进，也可以带着这个结论锁定。',
      actionLabel: '查看 AI 结果',
    }
  }
  return {
    icon: FileCheck2,
    eyebrow: '待推进',
    title: '提交这次推进结果',
    description: '这条节点已经准备好推进。提交结果后，会进入待确认 AI 结果。',
    actionLabel: '提交结果',
  }
}

const sourceIdsFor = (contract: ExecutionContract) => contract.sourceContractIds ?? (contract.parentContractId ? [contract.parentContractId] : [])

const recordDate = (record: { createdAt: string }) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))

export function ProjectPage() {
  const { projectId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const project = useExecStore((state) => state.projects.find((item) => item.id === projectId))
  const allContracts = useExecStore((state) => state.contracts)
  const allCompletionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const smartContracts = useExecStore((state) => state.smartContracts)
  const upgradeProjectContract = useExecStore((state) => state.upgradeProjectContract)
  const archiveProject = useExecStore((state) => state.archiveProject)
  const [nextSmartContractId, setNextSmartContractId] = useState('')
  const contracts = useMemo(() => allContracts.filter((contract) => contract.projectId === projectId), [allContracts, projectId])
  const completionRecords = useMemo(() => allCompletionRecords.filter((record) => record.projectId === projectId), [allCompletionRecords, projectId])
  const branches = useMemo(() => allBranches.filter((branch) => branch.projectId === projectId), [allBranches, projectId])

  if (!project) {
    return (
      <div className="rounded-md border border-rail bg-white/72 p-6">
        <h1 className="font-display text-3xl font-semibold">项目不存在</h1>
        <Link className="mt-4 inline-block text-sm font-semibold text-signal" to="/">返回我的项目</Link>
      </div>
    )
  }

  const activeRevision = project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId) ?? project.contractRevisions[0]
  const activeContract = smartContracts.find((contract) => contract.id === activeRevision?.smartContractId)
  const selectedContractId = nextSmartContractId || activeRevision?.smartContractId || ''
  const isArchived = Boolean(project.archivedAt)
  const unlockedContracts = contracts.filter((contract) => !contract.completionRecordId)
  const sortedCompletionRecords = completionRecords.slice().sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  const currentContract = contracts.find((contract) => contract.id === project.currentContractId)
  const requestedParentId = searchParams.get('parent') ?? undefined
  const requestedParent = contracts.find((contract) => contract.id === requestedParentId && contract.stage === 'completed')
  const isFork = searchParams.get('fork') === '1'
  const requestedBranch = branches.find((branch) => branch.id === searchParams.get('branch'))
  const activeBranchContracts = branches
    .map((branch) => ({ branch, contract: contracts.find((contract) => contract.id === branch.currentContractId) }))
    .filter((item): item is { branch: ExecutionBranch; contract: ExecutionContract } => Boolean(item.contract))
  const hasNonLinearStructure = branches.length > 0 || contracts.some((contract) => sourceIdsFor(contract).length > 1)
  const mergeSources = branches
    .map((branch) => contracts.find((contract) => contract.id === branch.headContractId && contract.completionRecordId))
    .filter((contract): contract is ExecutionContract => Boolean(contract))
    .filter((contract, index, list) => list.findIndex((item) => item.id === contract.id) === index)
  const latestRecord = sortedCompletionRecords.at(-1)
  const latestCompleted = latestRecord ? contracts.find((contract) => contract.id === latestRecord.closingContractId) : undefined

  return (
    <div className="space-y-9">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-signal">
            项目
            <ProjectVisibilityBadge visibility={project.visibility} />
            {isArchived ? <ProjectArchiveBadge /> : null}
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">{project.title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-graphite">{project.description}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-graphite">
            <span>{completionRecords.length} 条完成记录</span>
            <span>{unlockedContracts.length} 个推进节点未锁定</span>
            {branches.length > 0 ? <span>{branches.length} 条行为路径</span> : null}
          </div>
        </div>
        <div className="border-l-2 border-ink bg-[#efebe1] p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><LockKeyhole size={15} aria-hidden="true" />项目智能合约</div>
          <div className="mt-3 text-lg font-semibold text-ink">{activeContract?.name}</div>
          <p className="mt-2 text-sm leading-6 text-graphite">{activeContract?.description}</p>
        </div>
      </section>

      {isArchived ? <ArchivedProjectNotice /> : requestedParent ? <ProjectWorkstation project={project} contracts={contracts} currentContract={currentContract} activeBranchContracts={activeBranchContracts} latestCompleted={latestCompleted} requestedParent={requestedParent} requestedBranch={requestedBranch} isFork={isFork} /> : null}

      <ProjectQueues
        project={project}
        contracts={contracts}
        activeBranchContracts={activeBranchContracts}
        completionRecords={sortedCompletionRecords}
        showComposer={!isArchived && !requestedParent && !currentContract && activeBranchContracts.length === 0}
      />

      <section className="space-y-4 border-t border-rail pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="行为推进" title={hasNonLinearStructure ? '分叉中的项目状态' : '沿一条路径推进'} />
          <div className="font-mono text-xs font-semibold text-signal">{branches.length > 0 ? `${branches.length} 条路径` : '线性路径'}</div>
        </div>
        {contracts.length > 0 ? hasNonLinearStructure ? <ProjectGraph projectId={project.id} heightClassName="h-[460px] min-h-[360px]" /> : <LinearProgress contracts={contracts} /> : <div className="border-l-2 border-moss py-2 pl-4 text-sm leading-6 text-graphite">第一项行为通过审查后，这里会成为项目的推进记录。</div>}
      </section>

      {branches.length > 1 ? <ConvergenceGate project={project} branches={branches} sources={mergeSources} /> : null}

      <section className="border-t border-rail pt-8">
        <ProjectContractSettings
          project={project}
          smartContracts={smartContracts}
          activeContractId={activeRevision?.smartContractId ?? ''}
          selectedContractId={selectedContractId}
          onChange={setNextSmartContractId}
          onUpgrade={() => upgradeProjectContract(project.id, selectedContractId)}
          isArchived={isArchived}
          onArchive={() => archiveProject(project.id)}
        />
      </section>
    </div>
  )
}

type QueueListProps = {
  title: string
  eyebrow: string
  count: number
  icon: LucideIcon
  children: ReactNode
  empty: string
}

function ProjectQueues({ project, contracts, activeBranchContracts, completionRecords, showComposer }: { project: Project; contracts: ExecutionContract[]; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }>; completionRecords: CompletionRecord[]; showComposer: boolean }) {
  const currentContractIds = new Set([
    project.currentContractId ?? '',
    ...activeBranchContracts.map(({ contract }) => contract.id),
  ])
  const currentContracts = contracts.filter((contract) => currentContractIds.has(contract.id))
  const pendingProgress = currentContracts.filter((contract) => !contract.completionRecordId && contract.stage === 'frozen' && !contract.completionClaim)
  const awaitingConfirmation = currentContracts.filter((contract) => !contract.completionRecordId && (contract.stage === 'verified' || contract.stage === 'needs_supplement'))
  const reviewing = currentContracts.filter((contract) => !contract.completionRecordId && contract.stage === 'frozen' && Boolean(contract.completionClaim) && !contract.aiReview)

  return (
    <section className="space-y-5 border-y border-rail py-8" aria-labelledby="project-queues-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">项目工作区</div>
          <h2 id="project-queues-title" className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">按下一步处理</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{pendingProgress.length + awaitingConfirmation.length + reviewing.length} 个当前待处理节点</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QueueList title="待推进" eyebrow="Next action" count={pendingProgress.length} icon={FileCheck2} empty="暂无待推进节点。">
          {pendingProgress.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="pending" />)}
        </QueueList>
        <QueueList title="待确认 AI 结果" eyebrow="User decision" count={awaitingConfirmation.length} icon={CheckCircle2} empty="暂无等待确认的 AI 结果。">
          {awaitingConfirmation.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="confirmation" />)}
        </QueueList>
        <QueueList title="智能合约正在审核" eyebrow="AI review" count={reviewing.length} icon={Bot} empty="暂无正在审核的节点。">
          {reviewing.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="reviewing" />)}
        </QueueList>
        <QueueList title="完成记录" eyebrow="Locked records" count={completionRecords.length} icon={LockKeyhole} empty="暂无完成记录。">
          {completionRecords.slice().reverse().map((record) => <CompletionRecordRow key={record.id} record={record} />)}
        </QueueList>
      </div>

      {showComposer ? (
        <div id="new-node" className="grid gap-7 border-t border-rail pt-7 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <FlowIntroduction icon={FileCheck2} title={contracts.length > 0 ? '开始下一项推进' : '开始第一项推进'} />
          <ContractComposer projectId={project.id} lockProject />
        </div>
      ) : null}
    </section>
  )
}

function QueueList({ title, eyebrow, count, icon: Icon, children, empty }: QueueListProps) {
  return (
    <section className="min-w-0 border border-rail bg-white/50" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-rail px-4 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0 text-signal" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase text-signal">{eyebrow}</div>
            <h3 className="mt-1 truncate text-base font-semibold text-ink">{title}</h3>
          </div>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-graphite">{count}</span>
      </div>
      <div className="divide-y divide-rail">
        {count > 0 ? children : <div className="px-4 py-5 text-sm leading-6 text-graphite">{empty}</div>}
      </div>
    </section>
  )
}

function QueueNodeRow({ contract, mode }: { contract: ExecutionContract; mode: 'pending' | 'confirmation' | 'reviewing' }) {
  const reviewHint = mode === 'reviewing'
    ? '已提交推进结果 · 等待 AI 返回结论'
    : mode === 'confirmation'
      ? contract.aiReview?.verdict === 'pass' ? 'AI 已通过 · 等待确认' : 'AI 未通过 · 等待确认'
      : '打开节点提交这次推进结果'
  return (
    <Link to={`/contracts/${contract.id}`} className="group grid gap-3 px-4 py-4 transition hover:bg-white focus:outline-none focus-visible:shadow-focusline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{contract.title}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-graphite">{contract.verifiableGoal}</span>
        <span className={`mt-2 block text-xs font-semibold ${mode === 'confirmation' && contract.aiReview?.verdict !== 'pass' ? 'text-clay' : 'text-signal'}`}>{reviewHint}</span>
      </span>
      <span className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        {mode === 'reviewing' ? <span className="font-mono text-[11px] font-semibold text-signal">审核中</span> : <StatusBadge stage={contract.stage} />}
        <ArrowRight size={16} className="text-graphite transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
      </span>
    </Link>
  )
}

function CompletionRecordRow({ record }: { record: CompletionRecord }) {
  return (
    <Link to={`/contracts/${record.closingContractId}`} className="group grid gap-3 px-4 py-4 transition hover:bg-white focus:outline-none focus-visible:shadow-focusline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{record.title}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-graphite">覆盖 {record.coveredContractIds.length} 个推进节点 · {record.aiReviewVerdict === 'pass' ? 'AI 审查通过 · 用户确认' : 'AI 审查未通过 · 用户锁定'} · {recordDate(record)}</span>
      </span>
      <ArrowRight size={16} className="text-graphite transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
    </Link>
  )
}

function ProjectWorkstation({ project, contracts, currentContract, activeBranchContracts, latestCompleted, requestedParent, requestedBranch, isFork }: { project: Project; contracts: ExecutionContract[]; currentContract?: ExecutionContract; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }>; latestCompleted?: ExecutionContract; requestedParent?: ExecutionContract; requestedBranch?: ExecutionBranch; isFork: boolean }) {
  const activeActions = [
    ...(currentContract ? [{ branch: undefined, contract: currentContract }] : []),
    ...activeBranchContracts,
  ]
  if (requestedParent) {
    return (
      <section id="new-node" className="grid gap-7 border-y border-rail py-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <FlowIntroduction icon={isFork ? GitFork : ArrowRight} title={isFork ? `从「${requestedParent.title}」拆分新路径` : `从「${requestedParent.title}」继续下一项`} />
        <ContractComposer projectId={project.id} lockProject parentContractId={requestedParent.id} branchId={requestedBranch?.id} fork={isFork} />
      </section>
    )
  }

  if (activeActions.length > 1 || activeBranchContracts.length > 0) {
    return (
      <section className="space-y-5 border-y border-rail py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-semibold uppercase text-signal">当前行为</div>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">每条路径保留一次推进</h2>
          </div>
          <span className="text-sm font-semibold text-graphite">{activeActions.length} 个行动节点</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {activeActions.map(({ branch, contract }) => <div key={contract.id} className="space-y-2"><div className="font-mono text-xs font-semibold text-signal">{branch?.title ?? '项目主线'}</div><CurrentActionCard contract={contract} /></div>)}
        </div>
      </section>
    )
  }

  if (currentContract) return <CurrentActionSection contract={currentContract} />

  if (contracts.length > 0 && latestCompleted) {
    return (
      <section className="grid gap-6 border-y border-rail py-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">下一次推进</div>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">从最近完成记录继续</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-graphite">完成记录只锁定已经闭合的范围，下一项行动仍会作为新的节点加入链上。</p>
        </div>
        <NodeCard node={latestCompleted} actionLabel="查看收束节点" />
      </section>
    )
  }

  return (
    <section id="new-node" className="grid gap-7 border-y border-rail py-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <FlowIntroduction icon={LockKeyhole} title="开始第一项推进" />
      <ContractComposer projectId={project.id} lockProject />
    </section>
  )
}

function CurrentActionSection({ contract }: { contract: ExecutionContract }) {
  const copy = currentNodeCopy(contract)
  const Icon = copy.icon
  return (
    <section className="grid gap-6 border-y border-rail py-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={16} aria-hidden="true" />{copy.eyebrow}</div>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">{copy.title}</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-graphite">{copy.description}</p>
      </div>
      <CurrentActionCard contract={contract} />
    </section>
  )
}

function CurrentActionCard({ contract }: { contract: ExecutionContract }) {
  const action = currentNodeCopy(contract)
  const Icon = action.icon
  const nextStep = contract.stage === 'frozen'
    ? '提交后确认 AI 结果，再决定锁定或继续推进'
    : contract.stage === 'verified'
      ? '确认 AI 结果后，节点会被锁定'
      : '确认 AI 结果后，选择生成补足节点或锁定'
  return (
    <Link to={`/contracts/${contract.id}`} className="group block border-l-2 border-ink bg-white/72 p-6 transition hover:bg-white focus:outline-none focus-visible:shadow-focusline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={16} aria-hidden="true" />当前要处理</div>
        <StatusBadge stage={contract.stage} />
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold leading-tight text-ink">{contract.title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">{contract.verifiableGoal}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rail pt-4">
        <span className="text-sm leading-6 text-graphite">{nextStep}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">{action.actionLabel}<ArrowRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  )
}

function LinearProgress({ contracts }: { contracts: ExecutionContract[] }) {
  const ordered = [...contracts].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  return (
    <ol className="divide-y divide-rail border-y border-rail bg-white/50">
      {ordered.map((contract, index) => (
        <li key={contract.id}>
          <Link to={`/contracts/${contract.id}`} className="grid gap-3 px-4 py-4 transition hover:bg-white sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center focus:outline-none focus-visible:shadow-focusline">
            <span className="font-mono text-xs font-semibold text-signal">{String(index + 1).padStart(2, '0')}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{contract.title}</span><span className="mt-1 block text-xs text-graphite">{contract.completionRecordId ? '锁定' : contract.stage === 'needs_supplement' ? '待确认 AI 结果' : contract.stage === 'verified' ? '待确认 AI 结果' : '待推进'}</span></span>
            <StatusBadge stage={contract.stage} />
          </Link>
        </li>
      ))}
    </ol>
  )
}

function ConvergenceGate({ project, branches, sources }: { project: Project; branches: ExecutionBranch[]; sources: ExecutionContract[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const canConverge = sources.length >= 2
  return (
    <section className="space-y-5 border-t border-rail pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><GitMerge size={16} aria-hidden="true" />路径汇合</div>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{sources.length} / {branches.length} 条路径已有锁定记录</h2>
        </div>
        {canConverge && !isOpen ? <button type="button" onClick={() => setIsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline"><GitMerge size={16} aria-hidden="true" />开始汇合行动</button> : null}
      </div>
      {canConverge ? isOpen ? <ContractComposer projectId={project.id} lockProject sourceContractIds={sources.map((source) => source.id)} /> : <p className="text-sm leading-6 text-graphite">把多条路径的完成记录作为依据，开始一个普通行动节点。这个节点提交的结果仍由同一份智能合约审查，必要时可以把前置推进一起锁定。</p> : <p className="text-sm leading-6 text-graphite">当多条路径都形成完成记录后，可以从它们开始一项汇合行动；当前仍有路径在推进。</p>}
    </section>
  )
}

function FlowIntroduction({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="xl:pt-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={15} aria-hidden="true" />下一次推进</div><h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{title}</h2></div>
}

function ProjectVisibilityBadge({ visibility }: { visibility: Project['visibility'] }) {
  const isPublic = visibility === 'public'
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 normal-case ${isPublic ? 'border-signal/30 bg-signal/10 text-signal' : 'border-rail bg-white/70 text-graphite'}`}>{isPublic ? <Eye size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{isPublic ? '公开项目' : '私人项目'}</span>
}

function ProjectArchiveBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-graphite/20 bg-white/70 px-2 py-1 normal-case text-graphite"><Archive size={13} aria-hidden="true" />已归档</span>
}

function ArchivedProjectNotice() {
  return <section className="border-y border-rail py-8"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-graphite"><Archive size={16} aria-hidden="true" />Read-only project</div><h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">项目已归档</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">完成记录、行为路径和审查证据会一直保留，但不能再开始行为、提交结果、签名或修改项目智能合约。</p></section>
}

function ProjectContractSettings({ project, smartContracts, activeContractId, selectedContractId, onChange, onUpgrade, isArchived, onArchive }: { project: Project; smartContracts: ReturnType<typeof useExecStore.getState>['smartContracts']; activeContractId: string; selectedContractId: string; onChange: (value: string) => void; onUpgrade: () => void; isArchived: boolean; onArchive: () => void }) {
  const [confirmingArchive, setConfirmingArchive] = useState(false)

  return (
    <div className="grid max-w-3xl gap-4">
      {isArchived ? <div className="border-l-2 border-graphite py-2 pl-4 text-sm leading-6 text-graphite">项目智能合约与所有行为记录已锁定为只读记录。</div> : <details className="rounded-md border border-rail bg-white/72"><summary className="flex cursor-pointer list-none items-center gap-2 p-5 text-sm font-semibold text-ink marker:hidden focus:outline-none focus-visible:shadow-focusline"><Settings2 size={17} className="text-signal" aria-hidden="true" />修改项目智能合约</summary><div className="border-t border-rail px-5 pb-5 pt-4"><p className="text-sm leading-6 text-graphite">修改只影响之后开始的行为；已经开始的行为仍使用冻结时的合约。</p><label className="mt-5 grid gap-2"><span className="text-sm font-semibold text-ink">下一项行为使用的合约</span><select value={selectedContractId} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">{smartContracts.map((smartContract) => <option key={smartContract.id} value={smartContract.id}>{smartContract.name} · {smartContract.source === 'official' ? '平台提供' : '自定义'}</option>)}</select></label><button type="button" disabled={selectedContractId === activeContractId} onClick={onUpgrade} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:shadow-focusline"><Settings2 size={16} aria-hidden="true" />更新项目合约</button><div className="mt-6 border-t border-rail pt-4"><div className="font-mono text-xs font-semibold text-signal">合约变更记录</div><div className="mt-3 space-y-3">{project.contractRevisions.map((revision) => { const contract = smartContracts.find((item) => item.id === revision.smartContractId); const isCurrent = revision.id === project.activeContractRevisionId; return <div key={revision.id} className="border-l-2 border-rail pl-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-ink">{contract?.name}</span>{isCurrent ? <span className="font-mono text-xs font-semibold text-signal">当前</span> : null}</div><p className="mt-1 text-xs leading-5 text-graphite">{revision.reason}</p></div> })}</div></div></div></details>}
      {!project.isDefault && !isArchived ? <details className="rounded-md border border-clay/35 bg-clay/5"><summary className="flex cursor-pointer list-none items-center gap-2 p-5 text-sm font-semibold text-clay marker:hidden focus:outline-none focus-visible:shadow-focusline"><Archive size={17} aria-hidden="true" />归档项目</summary><div className="border-t border-clay/25 px-5 pb-5 pt-4"><p className="text-sm leading-6 text-graphite">归档后项目不可恢复为可写状态，完成记录、行为路径和证据仍可查看。</p>{confirmingArchive ? <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={onArchive} className="inline-flex h-10 items-center gap-2 rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-[#8c3f36] focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />确认归档</button><button type="button" onClick={() => setConfirmingArchive(false)} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">取消</button></div> : <button type="button" onClick={() => setConfirmingArchive(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-clay/40 bg-white px-3 text-sm font-semibold text-clay transition hover:border-clay focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />归档项目</button>}</div></details> : null}
    </div>
  )
}
