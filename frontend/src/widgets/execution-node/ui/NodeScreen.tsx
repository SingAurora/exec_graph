import { Bot, Check, GitBranchPlus, GitMerge, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ContractStageRail } from '@/entities/execution-node/ui/ContractStageRail'
import { CompletionConversation } from '@/features/conversation/ui/ActionConversation'
import { EvidenceCoverage } from '@/entities/execution-node/ui/EvidenceCoverage'
import { RelayRail } from '@/entities/execution-node/ui/RelayRail'
import { StatusBadge } from '@/entities/execution-node/ui/StatusBadge'
import { completionRecordForContract, isAcceptedRecord, isReviewInProgress, needsReviewDecision } from '@/entities/execution-node/model/selectors'
import { NodeEventLog, NodeTabs, ReviewAIIdentity, ReviewClarificationDialog, CompletionRecordSummary, CopyReviewStateButton, InfoBlock } from './node-review-panels'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import type { ExecutionContract } from '@/entities/execution-node/model/types'
import { criterionText, verdictText } from '@/entities/execution-node/model/reviewCopy'

type NodeTab = 'task' | 'completion' | 'events'

export function NodePage() {
  const { contractUuid = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contract = useExecStore((state) => state.contracts.find((item) => item.uuid === contractUuid))
  const project = useExecStore((state) => state.projects.find((item) => item.uuid === contract?.projectUuid))
  const smartContract = useExecStore((state) => state.smartContracts.find((item) => item.uuid === contract?.smartContractUuid))
  const allContracts = useExecStore((state) => state.contracts)
  const allEdges = useExecStore((state) => state.edges)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const reviewNodeClarification = useExecStore((state) => state.reviewNodeClarification)
  const confirmNodeCompletion = useExecStore((state) => state.confirmNodeCompletion)
  const [isClarificationOpen, setIsClarificationOpen] = useState(false)
  const [clarificationCriterionIds, setClarificationCriterionIds] = useState<string[]>([])
  const [clarificationExplanation, setClarificationExplanation] = useState('')
  const [clarificationEvidenceReferences, setClarificationEvidenceReferences] = useState('')
  const [clarificationEvidenceAddition, setClarificationEvidenceAddition] = useState('')
  const [clarificationEvidencePredatesSubmission, setClarificationEvidencePredatesSubmission] = useState(false)
  const [clarificationMode, setClarificationMode] = useState<'existing' | 'existing-evidence' | 'new-work'>('existing')
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
    const result = await confirmNodeCompletion(contract.uuid)
    if (!result.success) {
      return
    }
    navigate(`/contracts/${contract.uuid}?tab=completion`)
  }

  const onSubmitClarification = async () => {
    setClarificationMessage('')
    if (clarificationMode === 'new-work') return
    setIsClarifying(true)
    const result = await reviewNodeClarification(contract.uuid, {
      criterionIds: clarificationCriterionIds,
      explanation: clarificationExplanation,
      evidenceReferences: clarificationEvidenceReferences,
      evidenceAddition: clarificationEvidenceAddition,
      evidencePredatesSubmission: clarificationEvidencePredatesSubmission,
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
    setClarificationEvidenceAddition('')
    setClarificationEvidencePredatesSubmission(false)
    navigate(`/contracts/${contract.uuid}?tab=completion`)
  }

  const branch = allBranches.find((item) => item.uuid === contract.branchUuid)
  const isArchived = Boolean(project?.archivedAt)
  const isCurrent = !isArchived && (project?.currentContractUuid === contract.uuid || branch?.currentContractUuid === contract.uuid)
  const currentContract = allContracts.find((item) => item.uuid === (branch ? branch.currentContractUuid : project?.currentContractUuid))
  const isReviewing = isReviewInProgress(contract)
  const canSubmit = isCurrent && contract.stage === 'frozen' && !isReviewing
  const canUseCompletionConversation = isCurrent && !isArchived && contract.stage !== 'completed' && contract.stage !== 'sealed'
  const aiReviewPassed = contract.aiReview?.verdict === 'pass'
  const canLock = isCurrent && needsReviewDecision(contract) && Boolean(contract.aiReview)
  const canClarify = canLock && !contract.completionRecordUuid
  const supplement = allContracts.find((item) => item.supplementOfContractUuid === contract.uuid)
  const sourceIds = contract.sourceContractUuids ?? (contract.parentContractUuid ? [contract.parentContractUuid] : [])
  const sourceContracts = sourceIds
    .map((sourceId) => allContracts.find((item) => item.uuid === sourceId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hasMultipleSources = sourceContracts.length > 1
  const closureSourceUuids = allEdges.filter((edge) => edge.targetContractUuid === contract.uuid && edge.type === 'closure').map((edge) => edge.sourceContractUuid)
  const closureSources = closureSourceUuids
    .map((sourceId) => allContracts.find((item) => item.uuid === sourceId))
    .filter((item): item is ExecutionContract => Boolean(item))
  const criterionForReview = (criterionId: string) => {
    const [nodeUuid, localCriterionId] = criterionId.split('::')
    if (!localCriterionId) return contract.acceptanceCriteria.find((item) => item.id === criterionId)
    return allContracts.find((item) => item.uuid === nodeUuid)?.acceptanceCriteria.find((item) => item.id === localCriterionId)
  }
  const canSupplement = isCurrent && contract.stage === 'needs_supplement' && Boolean(contract.aiReview?.suggestedSupplementTitle) && !supplement
  const completionRecord = completionRecordForContract(completionRecords, contract)
  const canContinue =
    !isArchived &&
    Boolean(completionRecord && isAcceptedRecord(completionRecord)) &&
    Boolean(project) &&
    (branch ? branch.headContractUuid === contract.uuid && !branch.currentContractUuid : !project?.currentContractUuid)
  const canFork =
    !isArchived && Boolean(completionRecord && isAcceptedRecord(completionRecord)) && Boolean(project) && completionRecord?.closingContractUuid === contract.uuid
  const requestedTab = searchParams.get('tab')
  const activeTab: NodeTab = requestedTab === 'completion' || requestedTab === 'events' ? requestedTab : 'task'

  return (
    <div className="space-y-7">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge stage={contract.stage} />
            {hasMultipleSources ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[12px] font-semibold text-signal">
                <GitMerge size={13} aria-hidden="true" />
                多来源行动
              </span>
            ) : null}
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
          <p className="mt-4 text-sm leading-6 text-graphite">{smartContract?.description}</p>
        </div>
      </section>

        <RelayRail node={contract} contracts={allContracts} edges={allEdges} />
      <ContractStageRail stage={contract.stage} />

      <NodeTabs contractUuid={contract.uuid} activeTab={activeTab} />

      {activeTab === 'task' ? (
        <div className="space-y-7">
          {contract.draftReview ? (
            <section className={`border-l-2 py-3 pl-5 ${contract.draftReview.verdict === 'pass' ? 'border-moss' : 'border-clay'}`}>
              <div className={`font-mono text-xs font-semibold uppercase ${contract.draftReview.verdict === 'pass' ? 'text-moss' : 'text-clay'}`}>
                节点创建审核
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-semibold">
                  {contract.draftReview.verdict === 'pass' ? 'AI 已通过这项节点草案' : 'AI 未通过这项节点草案'}
                </h2>
                <span className="font-mono text-xs font-semibold text-graphite">
                  {new Intl.DateTimeFormat('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(contract.draftReview.createdAt))}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{contract.draftReview.summary}</p>
              <ReviewAIIdentity config={contract.draftReviewAIConfig ?? contract.draftReview.aiConfig} />
              {contract.draftReview.missingRequirements.length > 0 ? (
                <div className="mt-3 grid gap-1 text-sm leading-6 text-graphite">
                  {contract.draftReview.missingRequirements.map((requirement) => (
                    <div key={requirement}>需要补充：{requirement}</div>
                  ))}
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
              <div className="mt-5 border-t border-rail pt-4 text-xs leading-5 text-graphite">规则已冻结。不能修改目标、验收标准或证据要求来迁就结果。</div>
            </aside>
          </section>

          {canSubmit ? (
            <section className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-signal py-2 pl-5">
              <div>
                <div className="font-mono text-xs font-semibold uppercase text-signal">下一步</div>
                <p className="mt-1 text-sm text-graphite">任务规则已确定，可以提交本次推进结果。</p>
              </div>
              <Link
                to={`/contracts/${contract.uuid}?tab=completion`}
                className="inline-flex h-10 items-center justify-center px-3 text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
              >
                前往任务完成
              </Link>
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
                  <div key={source.uuid} className="border border-moss/25 bg-moss/5 p-3">
                    <Link to={`/contracts/${source.uuid}`} className="text-sm font-semibold text-signal hover:text-ink">
                      {source.title}
                    </Link>
                    <div className="mt-2 grid gap-1 text-xs leading-5 text-graphite">
                      {source.acceptanceCriteria.map((criterion) => (
                        <div key={criterion.id}>需要同时满足：{criterion.text}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isReviewing ? (
            <section className="border-l-2 border-signal bg-surface/50 py-3 pl-5">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
                <Bot size={15} aria-hidden="true" />
                智能合约正在审核
              </div>
              <h2 className="mt-2 font-display text-2xl font-semibold">等待智能合约返回审查结果</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite">
                推进结果已经提交，正在按照冻结的验收标准处理。审查完成后，这个节点会进入待确认 AI 结果。
              </p>
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
                这项行为保留为项目记录。现在需要处理的是「
                {currentContract.title}」。
              </p>
              <Link
                to={`/contracts/${currentContract.uuid}`}
                className="mt-3 inline-flex text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
              >
                打开当前行为
              </Link>
            </section>
          ) : null}

          {canUseCompletionConversation ? <CompletionConversation contract={contract} /> : null}

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
                <div className="flex flex-wrap items-center gap-2">
                  <CopyReviewStateButton contract={contract} projectTitle={project?.title ?? ''} />
                  <span
                    className={`rounded-full border bg-surface/70 px-3 py-1 font-mono text-xs font-semibold ${aiReviewPassed ? 'border-moss/30 text-moss' : 'border-clay/30 text-clay'}`}
                  >
                    AI 结论不可改写
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-graphite">{contract.aiReview.summary}</p>
              <ReviewAIIdentity config={contract.completionReviewAIConfig ?? contract.aiReview.aiConfig} />
              {contract.completionReviewRounds?.length ? (
                <div className="mt-3 font-mono text-xs font-semibold text-graphite">第 {contract.completionReviewRounds.length} 轮审查 · 最新结论</div>
              ) : null}
              <div className="mt-5 grid gap-3">
                {contract.aiReview.criterionReviews.map((review) => {
                  const criterion = criterionForReview(review.criterionId)
                  return (
                    <div key={review.criterionId} className="rounded-md border border-rail bg-surface/72 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-ink">{criterion?.text}</div>
                        <span className={`font-mono text-xs font-semibold ${review.result === 'met' ? 'text-moss' : 'text-clay'}`}>
                          {criterionText[review.result]}
                        </span>
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
                  <Link
                    to={`/projects/${contract.projectUuid}?supplement=${contract.uuid}${branch ? `&branch=${branch.uuid}` : ''}#new-node`}
                    className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-surface px-4 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
                  >
                    <GitBranchPlus size={17} aria-hidden="true" />
                    开始补足行动
                  </Link>
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
                    to={`/contracts/${supplement.uuid}`}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
                  >
                    打开补足行为
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {contract.aiReview ? <EvidenceCoverage contract={contract} /> : null}

          {completionRecord ? (
            <CompletionRecordSummary
              record={completionRecord}
              contracts={allContracts}
              closingContractUuid={completionRecord.closingContractUuid}
              currentContractUuid={contract.uuid}
            />
          ) : null}

          {canContinue && project ? (
            <section className="border-l-2 border-signal pl-5">
              <div className="font-mono text-xs font-semibold uppercase text-signal">{branch ? 'Continue path' : 'Continue record'}</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">继续下一项推进</h2>
              <Link
                to={`/projects/${project.uuid}?parent=${contract.uuid}${branch ? `&branch=${branch.uuid}` : ''}#new-node`}
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
                to={`/projects/${project.uuid}?parent=${contract.uuid}&fork=1#new-node`}
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
        branchUuid={branch?.uuid}
        isOpen={isClarificationOpen}
        mode={clarificationMode}
        criterionIds={clarificationCriterionIds}
        explanation={clarificationExplanation}
        evidenceReferences={clarificationEvidenceReferences}
        evidenceAddition={clarificationEvidenceAddition}
        evidencePredatesSubmission={clarificationEvidencePredatesSubmission}
        message={clarificationMessage}
        isSubmitting={isClarifying}
        onOpenChange={setIsClarificationOpen}
        onModeChange={setClarificationMode}
        onToggleCriterion={(criterionId) =>
          setClarificationCriterionIds((ids) => (ids.includes(criterionId) ? ids.filter((id) => id !== criterionId) : [...ids, criterionId]))
        }
        onExplanationChange={setClarificationExplanation}
        onEvidenceReferencesChange={setClarificationEvidenceReferences}
        onEvidenceAdditionChange={setClarificationEvidenceAddition}
        onEvidencePredatesSubmissionChange={setClarificationEvidencePredatesSubmission}
        onSubmit={onSubmitClarification}
      />
    </div>
  )
}
