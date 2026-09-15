import { Archive, ArchiveRestore, ArrowRight, Bot, CheckCircle2, Compass, Eye, FileCheck2, GitBranchPlus, GitFork, GitMerge, ListChecks, LockKeyhole, Network, Send, Settings2, ShieldCheck, Trash2, UsersRound, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ContractComposer } from '../components/ContractComposer'
import { ProjectGraph } from '../components/ProjectGraph'
import { SectionHeader } from '../components/SectionHeader'
import { StatusBadge } from '../components/StatusBadge'
import { getCall, submitContribution, type CollaborationCall, type CollaborationSubmission } from '../lib/collaboration'
import { currentContractIDs, isAcceptedRecord, isReadyToProgress, isReviewInProgress, isSealedRecord, needsReviewDecision } from '../lib/execution'
import { useExecStore } from '../store/useExecStore'
import type { CompletionRecord, ExecutionBranch, ExecutionContract, Project } from '../types'

type CurrentNodeCopy = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  actionLabel: string
}

type ProjectTab = 'nodes' | 'records' | 'graph' | 'profile' | 'ai'

const projectTabs: Array<{ id: ProjectTab; label: string; icon: LucideIcon }> = [
  { id: 'nodes', label: '行动', icon: FileCheck2 },
  { id: 'records', label: '成果与封存', icon: CheckCircle2 },
  { id: 'graph', label: '关系图', icon: GitFork },
  { id: 'profile', label: '项目资料', icon: Settings2 },
  { id: 'ai', label: '审查 AI', icon: Bot },
]

const projectTabFrom = (value: string | null): ProjectTab =>
  value === 'records' || value === 'graph' || value === 'profile' || value === 'ai' ? value : 'nodes'

type ProjectAIKey = {
  id: string
  provider: string
  label: string
  model: string
  baseUrl: string
}

const currentNodeCopy = (contract: ExecutionContract): CurrentNodeCopy => {
  if (contract.stage === 'verified') {
    return {
      icon: CheckCircle2,
      eyebrow: '待确认 AI 结果',
      title: '确认 AI 审查结果',
      description: 'AI 已通过审查。确认后会生成一条可接续的已验收成果。',
      actionLabel: '确认验收',
    }
  }
  if (contract.stage === 'needs_supplement') {
    return {
      icon: GitBranchPlus,
      eyebrow: '有缺口',
      title: '补足缺口或封存行动',
      description: 'AI 指出了未满足项。继续补足会保留这次行动的上下文；封存只保留记录，不会成为已验收成果。',
      actionLabel: '处理缺口',
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

const recordDate = (record: { createdAt: string }) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))

export function ProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const project = useExecStore((state) => state.projects.find((item) => item.id === projectId))
  const allContracts = useExecStore((state) => state.contracts)
  const allCompletionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const updateProject = useExecStore((state) => state.updateProject)
  const archiveProject = useExecStore((state) => state.archiveProject)
  const restoreProject = useExecStore((state) => state.restoreProject)
  const deleteProject = useExecStore((state) => state.deleteProject)
  const upgradeProjectContract = useExecStore((state) => state.upgradeProjectContract)
  const accessToken = useExecStore((state) => state.accessToken)
  const refreshWorkspace = useExecStore((state) => state.refreshWorkspace)
  const contracts = useMemo(() => allContracts.filter((contract) => contract.projectId === projectId), [allContracts, projectId])
  const completionRecords = useMemo(() => allCompletionRecords.filter((record) => record.projectId === projectId), [allCompletionRecords, projectId])
  const branches = useMemo(() => allBranches.filter((branch) => branch.projectId === projectId), [allBranches, projectId])

  if (!project) {
    return (
      <div className="rounded-md border border-rail bg-surface/72 p-6">
        <h1 className="font-display text-3xl font-semibold">项目不存在</h1>
        <Link className="mt-4 inline-block text-sm font-semibold text-signal" to="/">返回我的项目</Link>
      </div>
    )
  }

  const isArchived = Boolean(project.archivedAt)
  const unlockedContracts = contracts.filter((contract) => !contract.completionRecordId)
  const sortedCompletionRecords = completionRecords.slice().sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  const currentContract = contracts.find((contract) => contract.id === project.currentContractId)
  const requestedParentId = searchParams.get('parent') ?? undefined
  const requestedParent = contracts.find((contract) => contract.id === requestedParentId && contract.stage === 'completed')
  const requestedClosureId = searchParams.get('close') ?? undefined
  const requestedClosure = contracts.find((contract) => contract.id === requestedClosureId && contract.stage === 'frozen')
  const requestedSupplementId = searchParams.get('supplement') ?? undefined
  const requestedSupplement = contracts.find((contract) => contract.id === requestedSupplementId && contract.stage === 'needs_supplement')
  const requestedRetryId = searchParams.get('retry') ?? undefined
  const requestedRetry = contracts.find((contract) => contract.id === requestedRetryId && contract.stage === 'sealed')
  const isFork = searchParams.get('fork') === '1'
  const requestedBranch = branches.find((branch) => branch.id === (searchParams.get('branch') ?? requestedClosure?.branchId ?? requestedSupplement?.branchId))
  const activeBranchContracts = branches
    .map((branch) => ({ branch, contract: contracts.find((contract) => contract.id === branch.currentContractId) }))
    .filter((item): item is { branch: ExecutionBranch; contract: ExecutionContract } => Boolean(item.contract))
	const publishableCollaborationNodes = [currentContract, ...activeBranchContracts.map((item) => item.contract)]
		.filter((contract): contract is ExecutionContract => Boolean(contract && contract.stage === 'frozen'))
		.filter((contract, index, list) => list.findIndex((item) => item.id === contract.id) === index)
  const mergeSources = branches
    .map((branch) => contracts.find((contract) => contract.id === branch.headContractId && contract.stage === 'completed' && contract.completionRecordId))
    .filter((contract): contract is ExecutionContract => Boolean(contract))
    .filter((contract, index, list) => list.findIndex((item) => item.id === contract.id) === index)
  const latestRecord = sortedCompletionRecords.filter(isAcceptedRecord).at(-1)
  const latestCompleted = latestRecord ? contracts.find((contract) => contract.id === latestRecord.closingContractId) : undefined
  const requestedTab = projectTabFrom(searchParams.get('tab'))
  const activeTab = requestedParent || requestedClosure || requestedSupplement || requestedRetry ? 'nodes' : requestedTab

  return (
    <div className="space-y-9">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-signal">
            项目
            <ProjectVisibilityBadge visibility={project.visibility} />
            <ProjectTypeBadge projectType={project.projectType} />
            {isArchived ? <ProjectArchiveBadge /> : null}
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">{project.title}</h1>
          {project.description ? <p className="mt-3 max-w-3xl text-base leading-7 text-graphite">{project.description}</p> : null}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-graphite">
            <span>{completionRecords.filter(isAcceptedRecord).length} 条已验收成果</span>
            <span>{unlockedContracts.length} 个未闭合行动</span>
            {branches.length > 0 ? <span>{branches.length} 条行为路径</span> : null}
          </div>
        </div>
        <div className="border-l-2 border-ink bg-shell p-5">
          {project.projectType === 'guided' ? <>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><ListChecks size={15} aria-hidden="true" />项目规则</div>
            <div className="mt-3 text-lg font-semibold text-ink">AI 根据规则出具行动合约</div>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-graphite">{project.projectRules}</p>
          </> : <>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Compass size={15} aria-hidden="true" />自主推进</div>
            <div className="mt-3 text-lg font-semibold text-ink">下一步由你决定</div>
            <p className="mt-2 text-sm leading-6 text-graphite">每次行动由项目审查 AI 验证；只有通过并确认后才会成为可接续成果。</p>
          </>}
        </div>
      </section>

      <ProjectTabs project={project} activeTab={activeTab} />

      {project.contributionOrigin ? <ContributionOriginBanner origin={project.contributionOrigin} /> : null}

      {activeTab === 'nodes' ? (
        <>
          {isArchived ? <ArchivedProjectNotice /> : <ProjectWorkstation project={project} contracts={contracts} currentContract={currentContract} activeBranchContracts={activeBranchContracts} latestCompleted={latestCompleted} requestedParent={requestedParent} requestedClosure={requestedClosure} requestedSupplement={requestedSupplement} requestedRetry={requestedRetry} requestedBranch={requestedBranch} isFork={isFork} />}

          {project.visibility === 'public' ? publishableCollaborationNodes.map((node) => <ProjectCollaborationPublisher key={node.id} projectId={project.id} node={node} accessToken={accessToken} />) : null}

          <ProjectQueues
            project={project}
            contracts={contracts}
            activeBranchContracts={activeBranchContracts}
          />

          {branches.length > 1 ? <ConvergenceGate project={project} branches={branches} sources={mergeSources} /> : null}
        </>
      ) : null}

      {activeTab === 'records' ? <>
        {project.contributionOrigin ? <ContributionHandoff origin={project.contributionOrigin} records={completionRecords.filter(isAcceptedRecord)} token={accessToken} /> : null}
        <ProjectRecords records={sortedCompletionRecords} contracts={contracts} />
      </> : null}

      {activeTab === 'graph' ? (
        <ProjectGraphTab project={project} contracts={contracts} branches={branches} />
      ) : null}

      {activeTab === 'profile' ? (
        <ProjectProfileSettings
          project={project}
          isArchived={isArchived}
          onUpdateProject={(input) => updateProject(project.id, input)}
          onUpgradeContract={(smartContractId) => upgradeProjectContract(project.id, smartContractId)}
          onArchive={() => archiveProject(project.id)}
          onRestore={() => restoreProject(project.id)}
          onDelete={async () => {
            const result = await deleteProject(project.id)
            if (result.success) navigate('/')
          }}
        />
      ) : null}

      {activeTab === 'ai' ? (
        <ProjectAISettings project={project} accessToken={accessToken} isArchived={isArchived} onUpdated={refreshWorkspace} />
      ) : null}
    </div>
  )
}

function ProjectAISettings({ project, accessToken, isArchived, onUpdated }: { project: Project; accessToken: string; isArchived: boolean; onUpdated: () => Promise<unknown> }) {
  const [keys, setKeys] = useState<ProjectAIKey[]>([])
  const [selectedKeyID, setSelectedKeyID] = useState(project.reviewAIKeyId ?? '')
  const [isLoading, setIsLoading] = useState(Boolean(accessToken))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setSelectedKeyID(project.reviewAIKeyId ?? '')
  }, [project.reviewAIKeyId])

  useEffect(() => {
    if (!accessToken) {
      setKeys([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/ai-keys', { headers: { Authorization: `Bearer ${accessToken}` } })
        const data = (await response.json().catch(() => ({}))) as { keys?: ProjectAIKey[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? '读取 AI 密钥失败。')
        if (!cancelled) setKeys(data.keys ?? [])
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '读取 AI 密钥失败。')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [accessToken])

  const save = async () => {
    if (!selectedKeyID || !accessToken) return
    setIsSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/projects/${project.id}/ai-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ aiKeyId: selectedKeyID }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? '更新项目审查 AI 失败。')
      await onUpdated()
      setMessage('项目审查 AI 已更新。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新项目审查 AI 失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const selected = keys.find((key) => key.id === selectedKeyID)
  return (
    <section className="max-w-3xl rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={17} aria-hidden="true" />Review AI</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">项目审查 AI</h2>
      {isArchived ? <p className="mt-4 text-sm leading-6 text-graphite">项目已归档，审查配置保持为历史记录。</p> : null}
      {!isArchived ? (
        <>
          <label className="mt-5 grid gap-2">
            <span className="text-sm font-semibold text-ink">审核节点描述与完成证明</span>
            <select value={selectedKeyID} onChange={(event) => { setSelectedKeyID(event.target.value); setMessage('') }} disabled={isLoading || !accessToken} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">
              <option value="">选择 AI 配置</option>
              {keys.map((key) => <option key={key.id} value={key.id}>{key.label} · {key.provider} · {key.model}</option>)}
            </select>
          </label>
          {selected ? <p className="mt-3 text-sm text-graphite">{selected.label} · {selected.provider} · {selected.model}</p> : null}
          {keys.length === 0 && !isLoading ? <p className="mt-3 text-sm text-clay">请先到个人设置添加 AI 密钥。</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={!selectedKeyID || selectedKeyID === project.reviewAIKeyId || isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:shadow-focusline"><Bot size={16} aria-hidden="true" />保存审查 AI</button>
            {message ? <span className="text-sm font-semibold text-signal">{message}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

function ContributionOriginBanner({ origin }: { origin: NonNullable<Project['contributionOrigin']> }) {
  return (
    <section className="grid gap-4 border-y border-rail bg-shell/45 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />协作贡献工作区</div>
        <h2 className="mt-2 text-lg font-semibold text-ink">正在为「{origin.projectTitle}」补上「{origin.callTitle}」</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">你的行动会围绕这个缺口推进；成果通过验收后，在“成果与封存”中回交给维护者组合审查。</p>
		{origin.availableSources.length > 0 ? <p className="mt-2 max-w-3xl text-xs leading-5 text-graphite">可参考的已有成果：{origin.availableSources.map((source) => `「${source.title}」`).join('、')}。它们是协作背景，不会替代你的独立贡献。</p> : null}
      </div>
      <Link to={`/explore/projects/${origin.projectId}#call-${origin.callId}`} className="inline-flex h-10 items-center justify-center gap-2 border border-rail bg-surface px-3 text-sm font-semibold text-ink hover:border-signal"><ArrowRight size={16} aria-hidden="true" />查看原始协作目标</Link>
    </section>
  )
}

function ContributionHandoff({ origin, records, token }: { origin: NonNullable<Project['contributionOrigin']>; records: CompletionRecord[]; token: string }) {
  const [call, setCall] = useState<CollaborationCall | null>(null)
  const [submissions, setSubmissions] = useState<CollaborationSubmission[]>([])
  const [recordID, setRecordID] = useState('')
  const [mapping, setMapping] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getCall(token, origin.callId)
      setCall(data.call)
      setSubmissions(data.submissions)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '读取协作交接失败')
    }
  }, [origin.callId, token])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const available = records.find((record) => !submissions.some((submission) => submission.sourceRecordId === record.id))
    if (available) setRecordID((current) => current || available.id)
  }, [records, submissions])

  const submitted = submissions.filter((submission) => records.some((record) => record.id === submission.sourceRecordId))
  const availableRecords = records.filter((record) => !submissions.some((submission) => submission.sourceRecordId === record.id))
  const handoff = async () => {
    if (!recordID || mapping.trim().length < 8) {
      setMessage('说明这份成果对应目标标准的哪一部分，以及证据在哪里。')
      return
    }
    setBusy(true); setMessage('')
    try {
      await submitContribution(token, origin.callId, recordID, mapping, '')
      setMapping('')
      setMessage('成果已回交，等待维护者选择来源并进行组合审查。')
      await load()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '回交成果失败')
    } finally { setBusy(false) }
  }

  return (
    <section className="mb-7 border border-rail bg-surface">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />回交协作成果</div>
          <h2 className="mt-2 text-xl font-semibold text-ink">把已验收成果接回「{origin.projectTitle}」</h2>
          <p className="mt-2 text-sm leading-6 text-graphite">目标：{origin.verifiableGoal}</p>
          <div className="mt-4 border-y border-rail py-3 text-sm leading-6 text-graphite">
            {origin.acceptanceCriteria.map((criterion) => <p key={criterion.id}><span className="font-mono text-xs font-semibold text-signal">{criterion.id.toUpperCase()}</span> {criterion.text}</p>)}
          </div>
        </div>
        <aside className="border-l border-rail pl-0 lg:pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-graphite">当前状态</div>
          <div className="mt-3 text-sm leading-6 text-graphite">
            <p><b className="text-ink">{submitted.length}</b> 份本项目成果已回交</p>
            <p className="mt-1">开放缺口：<b className={call?.status === 'open' ? 'text-signal' : 'text-graphite'}>{call?.status === 'open' ? '仍在接收贡献' : call?.status === 'adopted' ? '已形成采纳' : '已关闭'}</b></p>
          </div>
        </aside>
      </div>
      {submitted.length > 0 ? <div className="divide-y divide-rail border-t border-rail">{submitted.map((submission) => <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><span className="font-semibold text-ink">{submission.sourceTitle}</span><span className={submission.status === 'adopted' ? 'font-semibold text-moss' : 'font-semibold text-graphite'}>{submission.status === 'adopted' ? '已被维护者采纳' : '等待组合审查'}</span></div>)}</div> : null}
      {call?.status === 'open' && availableRecords.length > 0 ? <div className="border-t border-rail bg-shell/45 p-5"><div className="grid gap-3"><select value={recordID} onChange={(event) => setRecordID(event.target.value)} className="h-11 border border-rail bg-paper px-3 text-sm outline-none focus:border-signal"><option value="">选择一份已验收成果</option>{availableRecords.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select><textarea value={mapping} onChange={(event) => setMapping(event.target.value)} placeholder="说明这份成果对应哪些验收标准，以及证据在哪里。" className="min-h-20 border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" /><button type="button" disabled={busy || !recordID} onClick={() => void handoff()} className="inline-flex h-10 w-fit items-center gap-2 bg-signal px-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} aria-hidden="true" />{busy ? '正在回交' : '提交回协作目标'}</button></div></div> : null}
      {availableRecords.length === 0 && submitted.length === 0 ? <p className="border-t border-rail px-5 py-4 text-sm leading-6 text-graphite">先完成并确认至少一项行动成果，它会出现在这里供你回交。</p> : null}
      {message ? <p className="border-t border-rail px-5 py-3 text-sm font-semibold text-graphite">{message}</p> : null}
    </section>
  )
}

function ProjectTabs({ project, activeTab }: { project: Project; activeTab: ProjectTab }) {
  const projectId = project.id
  return (
    <nav className="-mt-5 flex gap-1 overflow-x-auto border-b border-rail" aria-label="项目页面">
      {projectTabs.map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            to={tab.id === 'nodes' ? `/projects/${projectId}` : `/projects/${projectId}?tab=${tab.id}`}
            className={[
              'inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline',
              active ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink',
            ].join(' ')}
          >
            <Icon size={16} aria-hidden="true" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

function ProjectGraphTab({ project, contracts, branches }: { project: Project; contracts: ExecutionContract[]; branches: ExecutionBranch[] }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader eyebrow="节点关系" title="从上到下推进" />
        <div className="font-mono text-xs font-semibold text-signal">{contracts.length} 个节点 · {branches.length > 0 ? `${branches.length} 条路径` : '单一路径'}</div>
      </div>
      {contracts.length > 0 ? (
        <>
          <ProjectGraphLegend />
          <ProjectGraph projectId={project.id} heightClassName="h-[620px] min-h-[420px]" />
        </>
      ) : (
        <div className="border-l-2 border-moss py-2 pl-4 text-sm leading-6 text-graphite">第一项行为通过审查后，这里会成为项目的推进记录。</div>
      )}
    </section>
  )
}

function ProjectGraphLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3 border-y border-rail py-3 text-xs font-semibold text-graphite" aria-label="关系图图例">
      <LegendNode label="待推进" className="border-signal bg-surface" />
      <LegendNode label="待确认" className="border-moss bg-moss/10" />
      <LegendNode label="有缺口" className="border-clay bg-clay/10" />
      <LegendNode label="已验收" className="border-moss bg-moss/10 ring-2 ring-moss/35" />
      <LegendNode label="已封存" className="border-graphite bg-paper border-dashed" />
      <LegendLine label="继续" className="border-graphite" />
      <LegendLine label="分叉" className="border-signal border-dashed" />
      <LegendLine label="补充" className="border-clay border-dashed" />
      <LegendLine label="收束" className="border-moss border-dashed" />
      <LegendLine label="重新尝试" className="border-graphite border-dotted" />
    </div>
  )
}

function LegendNode({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3.5 w-3.5 rounded-full border-2 ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function LegendLine({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-0 w-7 border-t-2 ${className}`} aria-hidden="true" />
      {label}
    </span>
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

function ProjectQueues({ project, contracts, activeBranchContracts }: { project: Project; contracts: ExecutionContract[]; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }> }) {
  const currentContractIds = currentContractIDs([project], activeBranchContracts.map(({ branch }) => branch))
  const currentContracts = contracts.filter((contract) => currentContractIds.has(contract.id))
  const pendingProgress = currentContracts.filter((contract) => !contract.completionRecordId && isReadyToProgress(contract))
  const awaitingConfirmation = currentContracts.filter((contract) => !contract.completionRecordId && needsReviewDecision(contract))
  const reviewing = currentContracts.filter((contract) => !contract.completionRecordId && isReviewInProgress(contract))

  return (
    <section className="space-y-5 border-y border-rail py-8" aria-labelledby="project-queues-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">项目工作区</div>
          <h2 id="project-queues-title" className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">按下一步处理</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{pendingProgress.length + awaitingConfirmation.length + reviewing.length} 个当前待处理节点</span>
      </div>

      <div className="divide-y divide-rail border-y border-rail bg-surface">
        {awaitingConfirmation.length > 0 ? <QueueList title="等待你的确认" eyebrow="Your decision" count={awaitingConfirmation.length} icon={CheckCircle2} empty="">
          {awaitingConfirmation.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="confirmation" />)}
        </QueueList> : null}
        {reviewing.length > 0 ? <QueueList title="AI 正在审核" eyebrow="AI review" count={reviewing.length} icon={Bot} empty="">
          {reviewing.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="reviewing" />)}
        </QueueList> : null}
        {pendingProgress.length > 0 ? <QueueList title="等待推进" eyebrow="Next action" count={pendingProgress.length} icon={FileCheck2} empty="">
          {pendingProgress.map((contract) => <QueueNodeRow key={contract.id} contract={contract} mode="pending" />)}
        </QueueList> : null}
        {pendingProgress.length + awaitingConfirmation.length + reviewing.length === 0 ? <p className="px-5 py-4 text-sm text-graphite">当前没有需要处理的行动。</p> : null}
      </div>
    </section>
  )
}

function QueueList({ title, eyebrow, count, icon: Icon, children, empty }: QueueListProps) {
  return (
    <section className="min-w-0" aria-label={title}>
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
    <Link to={`/contracts/${contract.id}`} className="group grid gap-3 px-4 py-4 transition hover:bg-shell focus:outline-none focus-visible:shadow-focusline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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

function ProjectRecords({ records, contracts }: { records: CompletionRecord[]; contracts: ExecutionContract[] }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader eyebrow="Project records" title="项目记录" />
        <span className="text-sm font-semibold text-graphite">{records.filter(isAcceptedRecord).length} 条已验收 · {records.filter(isSealedRecord).length} 条已封存</span>
      </div>
      {records.length > 0 ? (
        <div className="border-y border-rail bg-surface">
          {records.slice().reverse().map((record) => {
            const isAccepted = isAcceptedRecord(record)
            const closingNode = contracts.find((contract) => contract.id === record.closingContractId)
            return (
              <Link key={record.id} to={`/contracts/${record.closingContractId}?tab=completion`} className="group grid gap-4 border-b border-rail px-5 py-5 last:border-b-0 transition hover:bg-shell/45 focus:outline-none focus-visible:shadow-focusline lg:grid-cols-[104px_minmax(0,1fr)_240px_auto] lg:items-start">
                <div className={`border-l-2 pl-3 font-mono text-xs font-semibold ${isAccepted ? 'border-moss text-moss' : 'border-graphite text-graphite'}`}>
                  {recordDate(record)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink group-hover:text-signal">{record.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{record.summary}</p>
                </div>
                <div className="text-xs leading-5 text-graphite">
                  <div className="font-semibold text-ink">覆盖 {record.coveredContractIds.length} 个推进节点</div>
                  <div className={`mt-1 font-semibold ${isAccepted ? 'text-moss' : 'text-graphite'}`}>{isAccepted ? 'AI 审查通过 · 用户确认' : 'AI 有缺口 · 已封存'}</div>
                  <div className="mt-1 truncate">收束节点：{closingNode?.title ?? '推进节点'}</div>
                </div>
                <ArrowRight size={17} className="mt-1 shrink-0 text-signal transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      ) : <div className="border-l-2 border-rail py-3 pl-5 text-sm leading-6 text-graphite">通过验收或封存一次行动后，记录会出现在这里。</div>}
    </section>
  )
}

function ProjectWorkstation({ project, contracts, currentContract, activeBranchContracts, latestCompleted, requestedParent, requestedClosure, requestedSupplement, requestedRetry, requestedBranch, isFork }: { project: Project; contracts: ExecutionContract[]; currentContract?: ExecutionContract; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }>; latestCompleted?: ExecutionContract; requestedParent?: ExecutionContract; requestedClosure?: ExecutionContract; requestedSupplement?: ExecutionContract; requestedRetry?: ExecutionContract; requestedBranch?: ExecutionBranch; isFork: boolean }) {
  const activeActions = [
    ...(currentContract ? [{ branch: undefined, contract: currentContract }] : []),
    ...activeBranchContracts,
  ]
  if (requestedParent) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={isFork ? GitFork : ArrowRight} title={isFork ? `从「${requestedParent.title}」拆分新路径` : `从「${requestedParent.title}」继续下一项`} />
        <ContractComposer projectId={project.id} lockProject parentContractId={requestedParent.id} branchId={requestedBranch?.id} fork={isFork} />
      </section>
    )
  }

  if (requestedClosure) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitMerge} title={`补齐并收束「${requestedClosure.title}」`} />
        <ContractComposer projectId={project.id} lockProject parentContractId={requestedClosure.id} sourceContractIds={[requestedClosure.id]} closureSourceIds={[requestedClosure.id]} branchId={requestedBranch?.id} />
      </section>
    )
  }

  if (requestedSupplement) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitBranchPlus} title={`补足「${requestedSupplement.title}」中的缺口`} />
        <ContractComposer projectId={project.id} lockProject parentContractId={requestedSupplement.id} sourceContractIds={[requestedSupplement.id]} supplementOfContractId={requestedSupplement.id} branchId={requestedBranch?.id} />
      </section>
    )
  }

  if (requestedRetry) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitBranchPlus} title={`从「${requestedRetry.title}」的经验重新尝试`} />
        <ContractComposer projectId={project.id} lockProject retryOfContractId={requestedRetry.id} />
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
      <section className="space-y-6 border-y border-rail py-8">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">下一次推进</div>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">从最近完成记录继续</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-graphite">完成记录只锁定已经闭合的范围，下一项行动仍会作为新的节点加入链上。</p>
        </div>
        <ContractComposer projectId={project.id} lockProject parentContractId={latestCompleted.id} />
      </section>
    )
  }

  if (contracts.length > 0) {
    const latestSealed = contracts.filter((contract) => contract.stage === 'sealed').sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
    return (
      <section className="space-y-6 border-y border-rail py-8">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-graphite">调整方向</div>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">保留这次经验，再开始新的尝试</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-graphite">封存不会变成已验收成果，但 AI 会带入原目标、已提交证据和指出的缺口，帮助你调整下一步。</p>
        </div>
        {latestSealed ? <ContractComposer projectId={project.id} lockProject retryOfContractId={latestSealed.id} /> : <div className="border-l-2 border-graphite py-2 pl-4 text-sm leading-6 text-graphite">当前项目没有可接续的已验收行动。</div>}
      </section>
    )
  }

  return (
    <section id="new-node" className="space-y-6 border-y border-rail py-8">
      <FlowIntroduction icon={LockKeyhole} title="创建第一项推进" />
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

function ProjectCollaborationPublisher({ projectId, node, accessToken }: { projectId: string; node: ExecutionContract; accessToken: string }) {
  const [isPublishing, setIsPublishing] = useState(false)
	const [published, setPublished] = useState(false)
  const [message, setMessage] = useState('')
  const publish = async () => {
    setIsPublishing(true); setMessage('')
    try {
      const response = await fetch(`/api/projects/${projectId}/collaboration-calls`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetContractId: node.id, title: node.title }) })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? '发布开放缺口失败。')
		setPublished(true)
      setMessage('开放缺口已发布，可以在协作探索中接收其他人的成果。')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '发布开放缺口失败。') }
    finally { setIsPublishing(false) }
  }
  return <section className="flex flex-wrap items-center justify-between gap-4 border-y border-rail py-5"><div><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><UsersRound size={15} />公开协作</div><p className="mt-2 text-sm leading-6 text-graphite">把这项冻结行动发布为开放缺口。贡献者只能提交自己的公开已验收成果，最终是否采纳仍由你确认。</p>{message ? <p className="mt-2 text-sm font-semibold text-signal">{message}</p> : null}</div><button type="button" disabled={isPublishing || published} onClick={publish} className="inline-flex h-10 shrink-0 items-center gap-2 border border-signal bg-surface px-3 text-sm font-semibold text-signal disabled:opacity-50"><UsersRound size={16} />{published ? '已发布' : '发布开放缺口'}</button></section>
}

function CurrentActionCard({ contract }: { contract: ExecutionContract }) {
  const action = currentNodeCopy(contract)
  const Icon = action.icon
  const nextStep = contract.stage === 'frozen'
    ? '提交后等待 AI 审查，再决定是否继续补足'
    : contract.stage === 'verified'
      ? '确认验收后，这次行动会成为可接续成果'
      : '可以继续补足，或封存这次尚未验收的行动'
  return (
    <Link to={`/contracts/${contract.id}`} className="group block border-l-2 border-ink bg-surface/72 p-6 transition hover:bg-shell focus:outline-none focus-visible:shadow-focusline">
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
        {canConverge && !isOpen ? <button type="button" onClick={() => setIsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"><GitMerge size={16} aria-hidden="true" />开始汇合行动</button> : null}
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
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 normal-case ${isPublic ? 'border-signal/30 bg-signal/10 text-signal' : 'border-rail bg-surface/70 text-graphite'}`}>{isPublic ? <Eye size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{isPublic ? '公开项目' : '私人项目'}</span>
}

function ProjectTypeBadge({ projectType }: { projectType: Project['projectType'] }) {
  const guided = projectType === 'guided'
  return <span className="inline-flex items-center gap-1 rounded-md border border-rail bg-surface/70 px-2 py-1 normal-case text-graphite">{guided ? <ListChecks size={13} aria-hidden="true" /> : <Compass size={13} aria-hidden="true" />}{guided ? '规则引导型' : '自主推进型'}</span>
}

function ProjectArchiveBadge() {
  return <span className="inline-flex items-center gap-1 rounded-md border border-graphite/20 bg-surface/70 px-2 py-1 normal-case text-graphite"><Archive size={13} aria-hidden="true" />已归档</span>
}

function ArchivedProjectNotice() {
  return <section className="border-y border-rail py-8"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-graphite"><Archive size={16} aria-hidden="true" />Read-only project</div><h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">项目已归档</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">完成记录、行为路径和审查证据会一直保留，但不能再开始行为、提交结果、签名或修改项目智能合约。</p></section>
}

function ProjectProfileSettings({
  project,
  isArchived,
  onUpdateProject,
  onUpgradeContract,
  onArchive,
  onRestore,
  onDelete,
}: {
  project: Project
  isArchived: boolean
  onUpdateProject: (input: { title: string; description: string; visibility: Project['visibility'] }) => Promise<{ success: boolean; message?: string }>
  onUpgradeContract: (smartContractId: string) => Promise<{ success: boolean; message?: string }>
  onArchive: () => Promise<{ success: boolean; message?: string }>
  onRestore: () => Promise<{ success: boolean; message?: string }>
  onDelete: () => Promise<void>
}) {
  return (
    <div className="grid max-w-3xl gap-4">
      {isArchived ? (
        <div className="border-l-2 border-graphite py-2 pl-4 text-sm leading-6 text-graphite">项目资料已锁定为只读记录。</div>
      ) : (
        <ProjectDetailsSettings key={project.id} project={project} onSave={onUpdateProject} />
      )}
      {!isArchived && project.projectType === 'autonomous' ? <ProjectContractSettings project={project} onUpgrade={onUpgradeContract} /> : null}
      <ProjectDangerZone isArchived={isArchived} projectTitle={project.title} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />
    </div>
  )
}

function ProjectContractSettings({ project, onUpgrade }: { project: Project; onUpgrade: (smartContractId: string) => Promise<{ success: boolean; message?: string }> }) {
  const smartContracts = useExecStore((state) => state.smartContracts)
  const activeRevision = project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId) ?? project.contractRevisions[0]
  const [selectedID, setSelectedID] = useState(activeRevision?.smartContractId ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const officialContracts = smartContracts.filter((contract) => contract.source === 'official')
  const customContracts = smartContracts.filter((contract) => contract.source === 'custom')
  const selected = smartContracts.find((contract) => contract.id === selectedID)

  useEffect(() => {
    setSelectedID(activeRevision?.smartContractId ?? '')
  }, [activeRevision?.smartContractId])

  const save = async () => {
    if (!selectedID || selectedID === activeRevision?.smartContractId) return
    setIsSaving(true)
    setMessage('')
    const result = await onUpgrade(selectedID)
    setMessage(result.success ? '项目智能合约已更新，新行动会使用这套规则。' : (result.message ?? '项目智能合约更新失败。'))
    setIsSaving(false)
  }

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><ShieldCheck size={17} aria-hidden="true" />Project contract</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">项目智能合约</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">自主推进型项目可以更换后续行动的审查规则。已经创建的行动保留创建时的合约版本。</p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">当前使用的规则</span>
          <select value={selectedID} onChange={(event) => { setSelectedID(event.target.value); setMessage('') }} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">
            <optgroup label="平台规则">
              {officialContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name} · {contract.description}</option>)}
            </optgroup>
            {customContracts.length > 0 ? <optgroup label="我的自定义规则">{customContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}</optgroup> : null}
          </select>
        </label>
        {selected ? <p className="border-l-2 border-signal py-2 pl-3 text-sm leading-6 text-graphite"><span className="font-semibold text-ink">{selected.name}</span>：{selected.description}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={isSaving || !selectedID || selectedID === activeRevision?.smartContractId} onClick={() => void save()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:shadow-focusline"><ShieldCheck size={16} aria-hidden="true" />{isSaving ? '正在保存' : '保存智能合约'}</button>
          {message ? <span className={`text-sm font-semibold ${message.includes('失败') || message.includes('不能') ? 'text-clay' : 'text-signal'}`}>{message}</span> : null}
        </div>
      </div>
    </section>
  )
}

function ProjectDetailsSettings({ project, onSave }: { project: Project; onSave: (input: { title: string; description: string; visibility: Project['visibility'] }) => Promise<{ success: boolean; message?: string }> }) {
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const [visibility, setVisibility] = useState<Project['visibility']>(project.visibility)
  const [message, setMessage] = useState('')

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setMessage('项目名称不能为空。')
      return
    }
    const result = await onSave({ title, description, visibility })
    setMessage(result.success ? '项目资料已更新。' : (result.message ?? '项目资料更新失败。'))
  }

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
        <Settings2 size={17} aria-hidden="true" />
        Project profile
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">编辑项目资料</h2>
      <form className="mt-5 grid gap-4" onSubmit={save}>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目名称</span><input value={title} onChange={(event) => { setTitle(event.target.value); setMessage('') }} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目描述（可选）</span><textarea value={description} onChange={(event) => { setDescription(event.target.value); setMessage('') }} className="min-h-24 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目可见性</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Project['visibility'])} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"><option value="private">私人项目</option><option value="public">公开项目</option></select></label>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"><Settings2 size={16} aria-hidden="true" />保存项目资料</button>{message ? <span className="text-sm font-semibold text-signal">{message}</span> : null}</div>
      </form>
    </section>
  )
}

function ProjectDangerZone({
  isArchived,
  projectTitle,
  onArchive,
  onRestore,
  onDelete,
}: {
  isArchived: boolean
  projectTitle: string
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <section className="rounded-md border border-clay/35 bg-clay/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-clay">
        <Settings2 size={17} aria-hidden="true" />
        危险操作
      </div>
      <div className="mt-4 divide-y divide-clay/15 border-y border-clay/15">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">{isArchived ? '撤销归档' : '归档项目'}</div>
            <p className="mt-1 text-sm leading-6 text-graphite">{isArchived ? '恢复后可以继续推进节点、提交审查和修改项目设置。' : '归档后项目进入只读，之后可以恢复。'}</p>
          </div>
          {isArchived ? (
            <button type="button" onClick={onRestore} className="inline-flex h-10 items-center gap-2 rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"><ArchiveRestore size={16} aria-hidden="true" />恢复项目</button>
          ) : confirmingArchive ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={onArchive} className="inline-flex h-10 items-center gap-2 rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-clayStrong focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />确认归档</button>
              <button type="button" onClick={() => setConfirmingArchive(false)} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingArchive(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-clay/40 bg-surface px-3 text-sm font-semibold text-clay transition hover:border-clay focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />归档项目</button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">删除项目</div>
            <p className="mt-1 text-sm leading-6 text-graphite">删除「{projectTitle}」以及它的节点、关系和完成记录。</p>
          </div>
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={onDelete} className="inline-flex h-10 items-center gap-2 rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-clayStrong focus:outline-none focus-visible:shadow-focusline"><Trash2 size={16} aria-hidden="true" />确认删除</button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-clay/40 bg-surface px-3 text-sm font-semibold text-clay transition hover:border-clay focus:outline-none focus-visible:shadow-focusline"><Trash2 size={16} aria-hidden="true" />删除项目</button>
          )}
        </div>
      </div>
    </section>
  )
}
