import { Bot, Check, Copy, Fingerprint, GitBranchPlus, GitMerge, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ContractStageRail } from '../components/ContractStageRail'
import { CompletionConversation } from '../components/ActionConversation'
import { EvidenceCoverage } from '../components/EvidenceCoverage'
import { RelayRail } from '../components/RelayRail'
import { StatusBadge } from '../components/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useExecStore } from '../store/useExecStore'
import type { AIConfigSnapshot, CompletionRecord, CompletionReviewRound, ExecutionContract } from '../types'

const verdictText = {
  pass: '通过',
  partial: '未通过，存在缺口',
  fail: '未通过',
}

const criterionText = {
  met: '满足',
  unclear: '证据不足',
  unmet: '未满足',
}

type NodeTab = 'task' | 'completion' | 'events'

export function NodePage() {
  const { contractId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contract = useExecStore((state) => state.contracts.find((item) => item.id === contractId))
  const project = useExecStore((state) => state.projects.find((item) => item.id === contract?.projectId))
  const smartContract = useExecStore((state) => state.smartContracts.find((item) => item.id === contract?.smartContractId))
  const allContracts = useExecStore((state) => state.contracts)
  const allEdges = useExecStore((state) => state.edges)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const submitReviewClarification = useExecStore((state) => state.submitReviewClarification)
  const confirmCompletion = useExecStore((state) => state.confirmCompletion)
  const createSupplementContract = useExecStore((state) => state.createSupplementContract)
  const [isClarificationOpen, setIsClarificationOpen] = useState(false)
  const [clarificationCriterionIds, setClarificationCriterionIds] = useState<string[]>([])
  const [clarificationExplanation, setClarificationExplanation] = useState('')
  const [clarificationEvidenceReferences, setClarificationEvidenceReferences] = useState('')
  const [clarificationMode, setClarificationMode] = useState<'existing' | 'new-work'>('existing')
  const [clarificationMessage, setClarificationMessage] = useState('')
  const [isClarifying, setIsClarifying] = useState(false)

  if (!contract) {
    return (
      <div className="rounded-md border border-rail bg-surface/72 p-6">
        <h1 className="font-display text-3xl font-semibold">智能合约不存在</h1>
        <Link className="mt-4 inline-block text-sm font-semibold text-signal" to="/">
          返回智能合约
        </Link>
      </div>
    )
  }

  const onConfirmCompletion = async () => {
    const result = await confirmCompletion(contract.id)
    if (!result.success) {
      return
    }
    navigate(`/contracts/${contract.id}?tab=completion`)
  }

  const onCreateSupplement = async () => {
    const result = await createSupplementContract(contract.id)
    if (!result.success) {
      return
    }
    navigate(`/projects/${contract.projectId}`)
  }

  const onSubmitClarification = async () => {
    setClarificationMessage('')
    if (clarificationMode === 'new-work') return
    setIsClarifying(true)
    const result = await submitReviewClarification(contract.id, {
      criterionIds: clarificationCriterionIds,
      explanation: clarificationExplanation,
      evidenceReferences: clarificationEvidenceReferences,
    })
    setIsClarifying(false)
    if (!result.success) {
      setClarificationMessage(result.message ?? '补充审查失败，请稍后重试。')
      return
    }
    setIsClarificationOpen(false)
    setClarificationCriterionIds([])
    setClarificationExplanation('')
    setClarificationEvidenceReferences('')
    navigate(`/contracts/${contract.id}?tab=completion`)
  }

  const branch = allBranches.find((item) => item.id === contract.branchId)
  const isArchived = Boolean(project?.archivedAt)
  const isCurrent = !isArchived && (project?.currentContractId === contract.id || branch?.currentContractId === contract.id)
  const currentContract = allContracts.find((item) => item.id === (branch ? branch.currentContractId : project?.currentContractId))
  const isReviewing = contract.stage === 'frozen' && Boolean(contract.completionClaim) && !contract.aiReview
  const canSubmit = isCurrent && contract.stage === 'frozen' && !isReviewing
  const canUseCompletionConversation = isCurrent && !isArchived && contract.stage !== 'completed' && contract.stage !== 'sealed'
  const aiReviewPassed = contract.aiReview?.verdict === 'pass'
  const canLock = isCurrent && (contract.stage === 'verified' || contract.stage === 'needs_supplement') && Boolean(contract.aiReview)
  const canClarify = canLock && !contract.completionRecordId
  const supplement = allContracts.find((item) => item.supplementOfContractId === contract.id)
  const sourceIds = contract.sourceContractIds ?? (contract.parentContractId ? [contract.parentContractId] : [])
  const sourceContracts = sourceIds
    .map((sourceId) => allContracts.find((item) => item.id === sourceId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hasMultipleSources = sourceContracts.length > 1
  const closureSourceIds = allEdges.filter((edge) => edge.targetContractId === contract.id && edge.type === 'closure').map((edge) => edge.sourceContractId)
  const closureSources = closureSourceIds
    .map((sourceId) => allContracts.find((item) => item.id === sourceId))
    .filter((item): item is ExecutionContract => Boolean(item))
  const criterionForReview = (criterionId: string) => {
    const [nodeId, localCriterionId] = criterionId.split('::')
    if (!localCriterionId) return contract.acceptanceCriteria.find((item) => item.id === criterionId)
    return allContracts.find((item) => item.id === nodeId)?.acceptanceCriteria.find((item) => item.id === localCriterionId)
  }
  const canSupplement =
    isCurrent && contract.stage === 'needs_supplement' && Boolean(contract.aiReview?.suggestedSupplementTitle) && !supplement
  const completionRecord = contract.completionRecordId
    ? completionRecords.find((record) => record.id === contract.completionRecordId)
    : completionRecords.find((record) => record.coveredContractIds.includes(contract.id))
  const canContinue =
    !isArchived &&
    completionRecord?.recordKind === 'accepted' &&
    Boolean(project) &&
    (branch ? branch.headContractId === contract.id && !branch.currentContractId : !project?.currentContractId)
  const canFork = !isArchived && completionRecord?.recordKind === 'accepted' && Boolean(project) && completionRecord.closingContractId === contract.id
  const requestedTab = searchParams.get('tab')
  const activeTab: NodeTab = requestedTab === 'completion' || requestedTab === 'events' ? requestedTab : 'task'

  return (
    <div className="space-y-7">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge stage={contract.stage} />
            {hasMultipleSources ? <span className="inline-flex items-center gap-1 rounded-md border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[12px] font-semibold text-signal"><GitMerge size={13} aria-hidden="true" />多来源行动</span> : null}
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight text-ink">{contract.title}</h1>
          <p className="mt-3 text-sm font-semibold text-signal">{project?.title}</p>
          {branch ? <p className="mt-2 text-sm font-semibold text-graphite">行为路径 · {branch.title}</p> : null}
        </div>

        <div className="border-l-2 border-ink bg-shell p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
            <Bot size={15} aria-hidden="true" />
            智能合约
          </div>
          <div className="mt-3 text-lg font-semibold">{smartContract?.name}</div>
          <div className="mt-1 text-sm text-graphite">{smartContract?.source === 'official' ? '平台提供' : '用户自定义'} · 项目智能合约</div>
          <div className="mt-4 flex items-center gap-2 border-t border-rail pt-3 font-mono text-xs font-semibold text-graphite">
            <Fingerprint size={14} aria-hidden="true" />
            规则指纹 {contract.ruleHash}
          </div>
          <p className="mt-4 text-sm leading-6 text-graphite">{smartContract?.description}</p>
        </div>
      </section>

      <RelayRail node={contract} />
      <ContractStageRail stage={contract.stage} />

      <NodeTabs contractId={contract.id} activeTab={activeTab} />

      {activeTab === 'task' ? (
        <div className="space-y-7">
          {contract.draftReview ? (
        <section className={`border-l-2 py-3 pl-5 ${contract.draftReview.verdict === 'pass' ? 'border-moss' : 'border-clay'}`}>
          <div className={`font-mono text-xs font-semibold uppercase ${contract.draftReview.verdict === 'pass' ? 'text-moss' : 'text-clay'}`}>节点创建审核</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold">{contract.draftReview.verdict === 'pass' ? 'AI 已通过这项节点草案' : 'AI 未通过这项节点草案'}</h2>
            <span className="font-mono text-xs font-semibold text-graphite">
              {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(contract.draftReview.createdAt))}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{contract.draftReview.summary}</p>
          <ReviewAIIdentity config={contract.draftReviewAIConfig ?? contract.draftReview.aiConfig} />
          {contract.draftReview.missingRequirements.length > 0 ? (
            <div className="mt-3 grid gap-1 text-sm leading-6 text-graphite">
              {contract.draftReview.missingRequirements.map((requirement) => <div key={requirement}>需要补充：{requirement}</div>)}
            </div>
          ) : null}
        </section>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-md border border-rail bg-surface/72 p-5">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
                <Scale size={15} aria-hidden="true" />
                Frozen rules
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold">这项任务的验收规则</h2>
              <p className="mt-3 text-sm leading-6 text-graphite">{contract.verifiableGoal}</p>
              <div className="mt-5 grid gap-3">
                {contract.acceptanceCriteria.map((criterion, index) => (
                  <div key={criterion.id} className="rounded-md border border-rail bg-paper p-4">
                    <div className="font-mono text-xs font-semibold text-signal">C{index + 1}</div>
                    <div className="mt-2 text-sm font-semibold text-ink">{criterion.text}</div>
                    <p className="mt-2 text-sm leading-6 text-graphite">{criterion.requiredEvidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-md border border-rail bg-shell p-5">
              <div className="font-mono text-xs font-semibold uppercase text-signal">任务原始说明</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{contract.originalIntent}</p>
              <div className="mt-5 font-mono text-xs font-semibold uppercase text-signal">证据要求</div>
              <p className="mt-3 text-sm leading-6 text-graphite">{contract.evidenceRequirement}</p>
              <div className="mt-5 border-t border-rail pt-4 text-xs leading-5 text-graphite">
                规则已冻结。不能修改目标、验收标准或证据要求来迁就结果。
              </div>
            </aside>
          </section>

          {canSubmit ? (
            <section className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-signal py-2 pl-5">
              <div>
                <div className="font-mono text-xs font-semibold uppercase text-signal">下一步</div>
                <p className="mt-1 text-sm text-graphite">任务规则已确定，可以提交本次推进结果。</p>
              </div>
              <Link to={`/contracts/${contract.id}?tab=completion`} className="inline-flex h-10 items-center justify-center px-3 text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">前往任务完成</Link>
            </section>
          ) : null}
        </div>
      ) : activeTab === 'completion' ? (
        <div className="space-y-7">
      {closureSources.length > 0 ? (
        <section className="border-l-2 border-moss py-2 pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-moss">收束范围</div>
          <p className="mt-2 text-sm leading-6 text-graphite">本节点提交时，智能合约会同时核验并收束以下未闭合节点：</p>
          <div className="mt-3 grid gap-3">
            {closureSources.map((source) => (
              <div key={source.id} className="border border-moss/25 bg-moss/5 p-3">
                <Link to={`/contracts/${source.id}`} className="text-sm font-semibold text-signal hover:text-ink">{source.title}</Link>
                <div className="mt-2 grid gap-1 text-xs leading-5 text-graphite">
                  {source.acceptanceCriteria.map((criterion) => <div key={criterion.id}>需要同时满足：{criterion.text}</div>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isReviewing ? (
        <section className="border-l-2 border-signal bg-surface/50 py-3 pl-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} aria-hidden="true" />智能合约正在审核</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">等待智能合约返回审查结果</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite">推进结果已经提交，正在按照冻结的验收标准处理。审查完成后，这个节点会进入待确认 AI 结果。</p>
        </section>
      ) : null}

      {isArchived ? (
        <section className="border-l-2 border-graphite py-1 pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-graphite">项目已归档</div>
          <p className="mt-2 text-sm leading-6 text-graphite">这项行为及其审查记录仍可查看，但项目不再接受提交、确认或继续。</p>
        </section>
      ) : null}

      {!isArchived && !isCurrent && currentContract ? (
        <section className="border-l-2 border-rail py-1 pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">项目当前行为</div>
          <p className="mt-2 text-sm leading-6 text-graphite">
            这项行为保留为项目记录。现在需要处理的是「{currentContract.title}」。
          </p>
          <Link
            to={`/contracts/${currentContract.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
          >
            打开当前行为
          </Link>
        </section>
      ) : null}

      {canUseCompletionConversation ? <CompletionConversation projectId={contract.projectId} nodeId={contract.id} /> : null}

      {contract.completionClaim ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <InfoBlock title="用户提交的推进结果" body={contract.completionClaim} />
          <InfoBlock title="用户提交的逐条证据" body={contract.evidenceText ?? '未提交。'} />
        </section>
      ) : null}

      {contract.aiReview ? (
        <section className={`rounded-md border p-5 ${aiReviewPassed ? 'border-moss/30 bg-moss/5' : 'border-clay/30 bg-clay/5'}`}>
          <div className={`font-mono text-xs font-semibold uppercase ${aiReviewPassed ? 'text-moss' : 'text-clay'}`}>AI review</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">AI 审查：{verdictText[contract.aiReview.verdict]}</h2>
            <span className={`rounded-full border bg-surface/70 px-3 py-1 font-mono text-xs font-semibold ${aiReviewPassed ? 'border-moss/30 text-moss' : 'border-clay/30 text-clay'}`}>
              AI 结论不可改写
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-graphite">{contract.aiReview.summary}</p>
          <ReviewAIIdentity config={contract.completionReviewAIConfig ?? contract.aiReview.aiConfig} />
          {contract.completionReviewRounds?.length ? <div className="mt-3 font-mono text-xs font-semibold text-graphite">第 {contract.completionReviewRounds.length} 轮审查 · 最新结论</div> : null}
          <div className="mt-5 grid gap-3">
            {contract.aiReview.criterionReviews.map((review) => {
              const criterion = criterionForReview(review.criterionId)
              return (
                <div key={review.criterionId} className="rounded-md border border-rail bg-surface/72 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{criterion?.text}</div>
                <span className={`font-mono text-xs font-semibold ${review.result === 'met' ? 'text-moss' : 'text-clay'}`}>{criterionText[review.result]}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-graphite">{review.reason}</p>
                </div>
              )
            })}
          </div>

          {canLock ? (
            <div className={`mt-5 rounded-md border p-4 ${aiReviewPassed ? 'border-moss/30 bg-moss/8' : 'border-clay/30 bg-clay/8'}`}>
              <p className="text-sm leading-6 text-graphite">
                {aiReviewPassed
                  ? 'AI 已通过审查。你确认后，这次推进会生成阶段完成记录。'
                  : 'AI 指出了尚未满足的验收项。你可以继续补足；若决定在此结束，这次行动会被封存，不能作为已验收成果接续。'}
              </p>
              <button
                type="button"
                onClick={onConfirmCompletion}
                className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition focus:outline-none focus-visible:shadow-focusline ${aiReviewPassed ? 'bg-moss hover:bg-mossStrong' : 'bg-clay hover:bg-clayStrong'}`}
              >
                <Check size={17} aria-hidden="true" />
                {aiReviewPassed ? '确认并生成验收记录' : '封存这次行动'}
              </button>
            </div>
          ) : null}

          {canSupplement ? (
            <div className="mt-5 rounded-md border border-clay/30 bg-surface/72 p-4">
              <div className="text-sm font-semibold text-ink">{contract.aiReview.suggestedSupplementTitle}</div>
              <p className="mt-2 text-sm leading-6 text-graphite">
                智能合约没有确认这项行为已经完成。原审查记录会保留；你可以把缺口变成下一项行为继续推进。
              </p>
              <button
                type="button"
                onClick={onCreateSupplement}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-surface px-4 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                <GitBranchPlus size={17} aria-hidden="true" />
                生成补足行为
              </button>
            </div>
          ) : null}
          {canClarify ? (
            <div className="mt-5 border-t border-clay/20 pt-4">
              <p className="text-sm leading-6 text-graphite">AI 可能误读了已有内容时，可以只说明证据所在位置或原意。新的工作不能补写进这次审查。</p>
              <button
                type="button"
                onClick={() => setIsClarificationOpen(true)}
                className="mt-3 inline-flex h-10 items-center justify-center border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"
              >
                补充审查说明
              </button>
            </div>
          ) : null}
          {supplement ? (
            <div className="mt-5 rounded-md border border-moss/30 bg-surface/72 p-4">
              <div className="text-sm font-semibold text-ink">补足行为已生成</div>
              <p className="mt-2 text-sm leading-6 text-graphite">原行为保留审查结论，缺口将在新的冻结规则中继续推进。</p>
              <Link
                to={`/contracts/${supplement.id}`}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                打开补足行为
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {contract.aiReview ? <EvidenceCoverage contract={contract} /> : null}

      {completionRecord ? <CompletionRecordSummary record={completionRecord} contracts={allContracts} closingContractId={completionRecord.closingContractId} currentContractId={contract.id} /> : null}

      {canContinue && project ? (
        <section className="border-l-2 border-signal pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">{branch ? 'Continue path' : 'Continue record'}</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">继续下一项推进</h2>
          <Link
            to={`/projects/${project.id}?parent=${contract.id}${branch ? `&branch=${branch.id}` : ''}#new-node`}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"
          >
            <GitBranchPlus size={17} aria-hidden="true" />
            {branch ? '沿此路径继续' : '继续下一项'}
          </Link>
        </section>
      ) : null}

      {canFork && project ? (
        <section className="border-l-2 border-signal pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">Split behavior</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">从这条记录拆分新路径</h2>
          <p className="mt-2 text-xs leading-5 text-graphite">把较大的目标拆成另一条推进路径；这条阶段完成记录会作为依据。</p>
          <Link
            to={`/projects/${project.id}?parent=${contract.id}&fork=1#new-node`}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-paper focus:outline-none focus-visible:shadow-focusline"
          >
            <GitBranchPlus size={17} aria-hidden="true" />
            拆分新路径
          </Link>
        </section>
      ) : null}

        </div>
      ) : (
        <NodeEventLog contract={contract} projectTitle={project?.title ?? ''} />
      )}

      <ReviewClarificationDialog
        contract={contract}
        branchId={branch?.id}
        isOpen={isClarificationOpen}
        mode={clarificationMode}
        criterionIds={clarificationCriterionIds}
        explanation={clarificationExplanation}
        evidenceReferences={clarificationEvidenceReferences}
        message={clarificationMessage}
        isSubmitting={isClarifying}
        onOpenChange={setIsClarificationOpen}
        onModeChange={setClarificationMode}
        onToggleCriterion={(criterionId) => setClarificationCriterionIds((ids) => ids.includes(criterionId) ? ids.filter((id) => id !== criterionId) : [...ids, criterionId])}
        onExplanationChange={setClarificationExplanation}
        onEvidenceReferencesChange={setClarificationEvidenceReferences}
        onSubmit={onSubmitClarification}
      />
    </div>
  )
}

function NodeTabs({ contractId, activeTab }: { contractId: string; activeTab: NodeTab }) {
  const tabs: Array<{ id: NodeTab; label: string }> = [
    { id: 'task', label: '行动目标' },
    { id: 'completion', label: '提交与验收' },
    { id: 'events', label: '完整记录' },
  ]

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-rail" aria-label="节点详情">
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            to={tab.id === 'task' ? `/contracts/${contractId}` : `/contracts/${contractId}?tab=${tab.id}`}
            className={[
              'inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline',
              active ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

function NodeEventLog({ contract, projectTitle }: { contract: ExecutionContract; projectTitle: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const reviewRounds = getReviewRounds(contract)

  const copyAllReviews = async () => {
    try {
      await navigator.clipboard.writeText(buildReviewTranscript(contract, projectTitle, reviewRounds))
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
    window.setTimeout(() => setCopyState('idle'), 2400)
  }

  return (
    <section className="border-y border-rail bg-surface px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">Event ledger</div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">行为审查记录</h2>
        </div>
        <button
          type="button"
          title="复制全部审查内容"
          aria-label="复制全部审查内容"
          onClick={copyAllReviews}
          className="grid size-10 shrink-0 place-items-center rounded-md border border-rail bg-surface text-graphite transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"
        >
          {copyState === 'success' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        </button>
      </div>
      {copyState === 'success' ? <p className="mt-3 text-sm font-semibold text-moss">已复制全部审查内容。</p> : null}
      {copyState === 'error' ? <p className="mt-3 text-sm font-semibold text-clay">复制失败，请检查浏览器权限。</p> : null}
      {reviewRounds.length > 0 ? (
        <div className="mt-5 grid gap-4 border-l border-rail pl-5">
          {reviewRounds.map((round, index) => (
            <article key={round.id} className="border-l-2 border-signal/45 bg-surface/65 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-xs font-semibold text-signal">第 {index + 1} 轮{round.kind === 'initial' ? ' · 初次审查' : ' · 澄清复审'}</div>
                <span className={round.review.verdict === 'pass' ? 'font-mono text-xs font-semibold text-moss' : 'font-mono text-xs font-semibold text-clay'}>{verdictText[round.review.verdict]}</span>
              </div>
              {round.clarification ? <div className="mt-3 border-l-2 border-amber/50 pl-3 text-sm leading-6 text-graphite"><div className="font-semibold text-ink">用户审查澄清</div><div className="mt-1">涉及：{round.clarification.criterionIds.join('、')}</div><div className="mt-1 whitespace-pre-wrap">{round.clarification.explanation}</div>{round.clarification.evidenceReferences ? <div className="mt-1 whitespace-pre-wrap">证据位置：{round.clarification.evidenceReferences}</div> : null}</div> : null}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{round.review.summary}</p>
              <ReviewAIIdentity config={round.aiConfig ?? round.review.aiConfig} />
            </article>
          ))}
        </div>
      ) : null}
      <div className="mt-5 border-l border-rail">
        {contract.reviewMessages.length > 0 ? contract.reviewMessages.map((message) => (
          <div key={message.id} className="relative border-b border-rail py-4 pl-5 last:border-b-0">
            <span className={`absolute -left-[5px] top-5 size-2 rounded-full ${message.speaker === 'ai' ? 'bg-amber' : 'bg-signal'}`} aria-hidden="true" />
            <div className="font-mono text-xs font-semibold text-signal">{message.speaker === 'ai' ? 'AI 审查' : '用户提交'}</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{message.body}</p>
          </div>
        )) : <p className="pl-5 text-sm leading-6 text-graphite">行为开始、提交结果、智能合约审查和本人确认都会记录在这里。</p>}
      </div>
    </section>
  )
}

type ReviewClarificationDialogProps = {
  contract: ExecutionContract
  branchId?: string
  isOpen: boolean
  mode: 'existing' | 'new-work'
  criterionIds: string[]
  explanation: string
  evidenceReferences: string
  message: string
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: 'existing' | 'new-work') => void
  onToggleCriterion: (criterionId: string) => void
  onExplanationChange: (value: string) => void
  onEvidenceReferencesChange: (value: string) => void
  onSubmit: () => void
}

function ReviewClarificationDialog({ contract, branchId, isOpen, mode, criterionIds, explanation, evidenceReferences, message, isSubmitting, onOpenChange, onModeChange, onToggleCriterion, onExplanationChange, onEvidenceReferencesChange, onSubmit }: ReviewClarificationDialogProps) {
  const newWorkHref = `/projects/${contract.projectId}?close=${contract.id}${branchId ? `&branch=${branchId}` : ''}#new-node`
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>补充审查说明</DialogTitle>
          <DialogDescription>只针对 AI 对已有证据的理解提出澄清。冻结任务、原始完成说明和原始证据都不会被改写。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-ink">这次说明属于什么情况</legend>
            <label className={`flex cursor-pointer gap-3 border p-3 text-sm ${mode === 'existing' ? 'border-signal bg-signal/5' : 'border-rail bg-surface'}`}>
              <input type="radio" name="clarification-mode" checked={mode === 'existing'} onChange={() => onModeChange('existing')} className="mt-0.5 accent-signal" />
              <span><strong className="text-ink">只澄清已有证据</strong><span className="mt-1 block leading-6 text-graphite">AI 可能漏看、误读或没有定位到原始提交中的内容。</span></span>
            </label>
            <label className={`flex cursor-pointer gap-3 border p-3 text-sm ${mode === 'new-work' ? 'border-clay bg-clay/5' : 'border-rail bg-surface'}`}>
              <input type="radio" name="clarification-mode" checked={mode === 'new-work'} onChange={() => onModeChange('new-work')} className="mt-0.5 accent-clay" />
              <span><strong className="text-ink">我完成了新的工作</strong><span className="mt-1 block leading-6 text-graphite">新的工作必须成为新的推进节点，不能倒灌进已提交的审查。</span></span>
            </label>
          </fieldset>

          {mode === 'new-work' ? (
            <div className="mt-6 border-l-2 border-clay bg-clay/5 p-4">
              <p className="text-sm leading-6 text-graphite">保留这轮审查和原始提交，然后创建一项补足推进来记录新增工作。</p>
              <Link to={newWorkHref} onClick={() => onOpenChange(false)} className="mt-4 inline-flex h-10 items-center justify-center border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline">新增补足推进</Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-ink">AI 可能误解的验收标准</legend>
                {contract.acceptanceCriteria.map((criterion, index) => (
                  <label key={criterion.id} className="flex cursor-pointer gap-3 border border-rail bg-surface p-3 text-sm leading-6 text-graphite">
                    <input type="checkbox" checked={criterionIds.includes(criterion.id)} onChange={() => onToggleCriterion(criterion.id)} className="mt-1 accent-signal" />
                    <span><strong className="mr-2 font-mono text-signal">C{index + 1}</strong>{criterion.text}</span>
                  </label>
                ))}
              </fieldset>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">澄清说明</span>
                <textarea value={explanation} onChange={(event) => onExplanationChange(event.target.value)} placeholder="说明 AI 对已有内容的误解，以及原始提交中实际表达的内容。" className="min-h-32 rounded-md border border-rail bg-surface px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">已有证据的位置</span>
                <textarea value={evidenceReferences} onChange={(event) => onEvidenceReferencesChange(event.target.value)} placeholder="例如：完成说明第 2 段；C2 的链接第 3 项。" className="min-h-24 rounded-md border border-rail bg-surface px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline" />
              </label>
              {message ? <p className="text-sm font-semibold text-clay">{message}</p> : null}
              <button type="button" disabled={isSubmitting} onClick={onSubmit} className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"><Bot size={17} aria-hidden="true" />{isSubmitting ? '正在复审' : '提交澄清并复审'}</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getReviewRounds(contract: ExecutionContract): CompletionReviewRound[] {
  if (contract.completionReviewRounds?.length) return contract.completionReviewRounds
  if (!contract.aiReview) return []
  return [{
    id: contract.aiReview.id,
    kind: 'initial',
    review: contract.aiReview,
    aiConfig: contract.completionReviewAIConfig ?? contract.aiReview.aiConfig,
    createdAt: contract.aiReview.createdAt,
  }]
}

function buildReviewTranscript(contract: ExecutionContract, projectTitle: string, reviewRounds: CompletionReviewRound[]) {
  const blocks = [
    `# 节点审查记录：${contract.title}`,
    `项目：${projectTitle || contract.projectId}`,
    `节点：${contract.id}`,
    '',
    '## 冻结可验证目标',
    contract.verifiableGoal,
    '',
    '## 验收标准',
    ...contract.acceptanceCriteria.flatMap((criterion, index) => [`### C${index + 1}`, criterion.text, `证据要求：${criterion.requiredEvidence}`, '']),
    '## 原始完成说明',
    contract.completionClaim ?? '未提交。',
    '',
    '## 原始逐条证据',
    contract.evidenceText ?? '未提交。',
    '',
    '## 审查轮次',
    ...reviewRounds.flatMap((round, index) => [
      `### 第 ${index + 1} 轮${round.kind === 'initial' ? '：初次审查' : '：澄清复审'}`,
      `时间：${round.createdAt}`,
      `审查配置：${[round.aiConfig ?? round.review.aiConfig].filter(Boolean).map((config) => `${config?.label} / ${config?.provider} / ${config?.model}`).join('') || '未记录'}`,
      ...(round.clarification ? [`澄清标准：${round.clarification.criterionIds.join('、')}`, `澄清说明：${round.clarification.explanation}`, ...(round.clarification.evidenceReferences ? [`证据位置：${round.clarification.evidenceReferences}`] : [])] : []),
      `结论：${verdictText[round.review.verdict]}`,
      `摘要：${round.review.summary}`,
      ...round.review.criterionReviews.flatMap((review) => [`- ${review.criterionId}：${criterionText[review.result]}。${review.reason}`]),
      '',
    ]),
    '## 事件记录',
    ...contract.reviewMessages.flatMap((message) => [`### ${message.speaker === 'ai' ? 'AI 审查' : '用户提交'} · ${message.createdAt}`, message.body, '']),
  ]
  return blocks.join('\n')
}

function ReviewAIIdentity({ config }: { config?: AIConfigSnapshot }) {
  if (!config) return null
  return <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-signal/35 pl-3 text-xs font-semibold text-graphite"><span>审查配置</span><span className="text-ink">{config.label}</span><span>{config.provider}</span><span>{config.model}</span></div>
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-rail bg-surface p-4">
      <div className="font-mono text-xs font-semibold text-signal">{title}</div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{body}</p>
    </div>
  )
}

function CompletionRecordSummary({ record, contracts, closingContractId, currentContractId }: { record: CompletionRecord; contracts: ExecutionContract[]; closingContractId: string; currentContractId: string }) {
  const isClosingNode = closingContractId === currentContractId
  const isAccepted = record.recordKind === 'accepted'
  return (
    <section className={`rounded-md border p-5 ${isAccepted ? 'border-moss/35 bg-moss/8' : 'border-graphite/30 bg-shell'}`}>
      <div className={`font-mono text-xs font-semibold uppercase ${isAccepted ? 'text-moss' : 'text-graphite'}`}>{isAccepted ? 'Accepted record' : 'Sealed record'}</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{isAccepted ? '已纳入阶段验收成果' : '已封存，尚未验收'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">{record.summary}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-graphite">
        <span>覆盖 {record.coveredContractIds.length} 个推进节点</span>
        <span className={isAccepted ? 'text-moss' : 'text-graphite'}>{isAccepted ? 'AI 审查通过 · 用户确认' : 'AI 有缺口 · 用户封存'}</span>
        <span>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))}</span>
      </div>
      <div className={`mt-4 border-t pt-4 ${isAccepted ? 'border-moss/20' : 'border-rail'}`}>
        <div className={`font-mono text-xs font-semibold ${isAccepted ? 'text-moss' : 'text-graphite'}`}>{isAccepted ? '本次验收范围' : '本次封存范围'}</div>
        <div className="mt-2 grid gap-1 text-sm text-graphite">
          {record.coveredContractIds.map((contractId) => <span key={contractId}>{contracts.find((contract) => contract.id === contractId)?.title ?? '推进节点'}</span>)}
        </div>
      </div>
      {!isClosingNode ? <Link to={`/contracts/${closingContractId}`} className="mt-4 inline-flex items-center text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline">打开收束节点</Link> : null}
    </section>
  )
}
