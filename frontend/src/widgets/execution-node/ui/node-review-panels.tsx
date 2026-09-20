import { Bot, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { isAcceptedRecord } from '@/entities/execution-node/model/selectors'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import type { AIConfigSnapshot, CompletionRecord, CompletionReviewRound, ExecutionContract } from '@/entities/execution-node/model/types'
import { criterionText, verdictText } from '../model/reviewCopy'
type NodeTab = 'task' | 'completion' | 'events'

export function NodeTabs({ contractId, activeTab }: { contractId: string; activeTab: NodeTab }) {
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

export function NodeEventLog({ contract, projectTitle }: { contract: ExecutionContract; projectTitle: string }) {
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
                <div className="font-mono text-xs font-semibold text-signal">
                  第 {index + 1} 轮{round.kind === 'initial' ? ' · 初次审查' : ' · 澄清复审'}
                </div>
                <span className={round.review.verdict === 'pass' ? 'font-mono text-xs font-semibold text-moss' : 'font-mono text-xs font-semibold text-clay'}>
                  {verdictText[round.review.verdict]}
                </span>
              </div>
              {round.clarification ? (
                <div className="mt-3 border-l-2 border-amber/50 pl-3 text-sm leading-6 text-graphite">
                  <div className="font-semibold text-ink">{round.clarification.evidenceAddition ? '用户补交的既有证据' : '用户审查澄清'}</div>
                  <div className="mt-1">涉及：{round.clarification.criterionIds.join('、')}</div>
                  {round.clarification.explanation ? <div className="mt-1 whitespace-pre-wrap">{round.clarification.explanation}</div> : null}
                  {round.clarification.evidenceReferences ? (
                    <div className="mt-1 whitespace-pre-wrap">证据位置：{round.clarification.evidenceReferences}</div>
                  ) : null}
                  {round.clarification.evidenceAddition ? (
                    <>
                      <div className="mt-1 text-xs font-semibold text-amber">用户已声明：材料在首次提交前已存在</div>
                      <div className="mt-3 whitespace-pre-wrap border-t border-amber/25 pt-3">{round.clarification.evidenceAddition}</div>
                    </>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{round.review.summary}</p>
              <ReviewAIIdentity config={round.aiConfig ?? round.review.aiConfig} />
            </article>
          ))}
        </div>
      ) : null}
      <div className="mt-5 border-l border-rail">
        {contract.reviewMessages.length > 0 ? (
          contract.reviewMessages.map((message) => (
            <div key={message.id} className="relative border-b border-rail py-4 pl-5 last:border-b-0">
              <span className={`absolute -left-[5px] top-5 size-2 rounded-full ${message.speaker === 'ai' ? 'bg-amber' : 'bg-signal'}`} aria-hidden="true" />
              <div className="font-mono text-xs font-semibold text-signal">{message.speaker === 'ai' ? 'AI 审查' : '用户提交'}</div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{message.body}</p>
            </div>
          ))
        ) : (
          <p className="pl-5 text-sm leading-6 text-graphite">行为开始、提交结果、智能合约审查和本人确认都会记录在这里。</p>
        )}
      </div>
    </section>
  )
}

type ReviewClarificationDialogProps = {
  contract: ExecutionContract
  branchId?: string
  isOpen: boolean
  mode: 'existing' | 'existing-evidence' | 'new-work'
  criterionIds: string[]
  explanation: string
  evidenceReferences: string
  evidenceAddition: string
  evidencePredatesSubmission: boolean
  message: string
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: 'existing' | 'existing-evidence' | 'new-work') => void
  onToggleCriterion: (criterionId: string) => void
  onExplanationChange: (value: string) => void
  onEvidenceReferencesChange: (value: string) => void
  onEvidenceAdditionChange: (value: string) => void
  onEvidencePredatesSubmissionChange: (value: boolean) => void
  onSubmit: () => void
}

export function ReviewClarificationDialog({
  contract,
  branchId,
  isOpen,
  mode,
  criterionIds,
  explanation,
  evidenceReferences,
  evidenceAddition,
  evidencePredatesSubmission,
  message,
  isSubmitting,
  onOpenChange,
  onModeChange,
  onToggleCriterion,
  onExplanationChange,
  onEvidenceReferencesChange,
  onEvidenceAdditionChange,
  onEvidencePredatesSubmissionChange,
  onSubmit,
}: ReviewClarificationDialogProps) {
  const newWorkHref = `/projects/${contract.projectId}?supplement=${contract.id}${branchId ? `&branch=${branchId}` : ''}#new-node`
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>补充审查材料</DialogTitle>
          <DialogDescription>冻结任务和原始提交不会被改写。可澄清原材料，或补交首次提交前已存在但遗漏附上的证据。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-ink">这次说明属于什么情况</legend>
            <label className={`flex cursor-pointer gap-3 border p-3 text-sm ${mode === 'existing' ? 'border-signal bg-signal/5' : 'border-rail bg-surface'}`}>
              <input
                type="radio"
                name="clarification-mode"
                checked={mode === 'existing'}
                onChange={() => onModeChange('existing')}
                className="mt-0.5 accent-signal"
              />
              <span>
                <strong className="text-ink">只澄清已有证据</strong>
                <span className="mt-1 block leading-6 text-graphite">AI 可能漏看、误读或没有定位到原始提交中的内容。</span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer gap-3 border p-3 text-sm ${mode === 'existing-evidence' ? 'border-amber bg-amber/5' : 'border-rail bg-surface'}`}
            >
              <input
                type="radio"
                name="clarification-mode"
                checked={mode === 'existing-evidence'}
                onChange={() => onModeChange('existing-evidence')}
                className="mt-0.5 accent-amber"
              />
              <span>
                <strong className="text-ink">补交提交前已存在的证据</strong>
                <span className="mt-1 block leading-6 text-graphite">适用于遗漏粘贴的原话、截图说明、导出记录或已有链接。它会作为独立材料留在审查记录中。</span>
              </span>
            </label>
            <label className={`flex cursor-pointer gap-3 border p-3 text-sm ${mode === 'new-work' ? 'border-clay bg-clay/5' : 'border-rail bg-surface'}`}>
              <input
                type="radio"
                name="clarification-mode"
                checked={mode === 'new-work'}
                onChange={() => onModeChange('new-work')}
                className="mt-0.5 accent-clay"
              />
              <span>
                <strong className="text-ink">我完成了新的工作</strong>
                <span className="mt-1 block leading-6 text-graphite">新的工作必须成为新的推进节点，不能倒灌进已提交的审查。</span>
              </span>
            </label>
          </fieldset>

          {mode === 'new-work' ? (
            <div className="mt-6 border-l-2 border-clay bg-clay/5 p-4">
              <p className="text-sm leading-6 text-graphite">保留这轮审查和原始提交，然后创建一项补足推进来记录新增工作。</p>
              <Link
                to={newWorkHref}
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-flex h-10 items-center justify-center border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"
              >
                新增补足推进
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-ink">AI 可能误解的验收标准</legend>
                {contract.acceptanceCriteria.map((criterion, index) => (
                  <label key={criterion.id} className="flex cursor-pointer gap-3 border border-rail bg-surface p-3 text-sm leading-6 text-graphite">
                    <input
                      type="checkbox"
                      checked={criterionIds.includes(criterion.id)}
                      onChange={() => onToggleCriterion(criterion.id)}
                      className="mt-1 accent-signal"
                    />
                    <span>
                      <strong className="mr-2 font-mono text-signal">C{index + 1}</strong>
                      {criterion.text}
                    </span>
                  </label>
                ))}
              </fieldset>
              {mode === 'existing-evidence' ? (
                <>
                  <div className="border-l-2 border-amber bg-amber/5 p-3 text-sm leading-6 text-graphite">
                    仅补交首次提交与初次审查前已经存在的材料。若证据来自之后新完成的工作，请建立新的补足推进。
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-ink">补交的既有证据</span>
                    <textarea
                      value={evidenceAddition}
                      onChange={(event) => onEvidenceAdditionChange(event.target.value)}
                      placeholder="粘贴原始消息、时间戳、汇总表、截图说明或链接。请说明这些材料在首次提交前已经存在。"
                      className="min-h-56 rounded-md border border-rail bg-surface px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline"
                    />
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm leading-6 text-graphite">
                    <input
                      type="checkbox"
                      checked={evidencePredatesSubmission}
                      onChange={(event) => onEvidencePredatesSubmissionChange(event.target.checked)}
                      className="mt-1 accent-signal"
                    />
                    我确认以上材料在首次提交前已经存在，不是为本次复审新完成的工作。
                  </label>
                </>
              ) : (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-ink">澄清说明</span>
                    <textarea
                      value={explanation}
                      onChange={(event) => onExplanationChange(event.target.value)}
                      placeholder="说明 AI 对已有内容的误解，以及原始提交中实际表达的内容。"
                      className="min-h-32 rounded-md border border-rail bg-surface px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-ink">已有证据的位置</span>
                    <textarea
                      value={evidenceReferences}
                      onChange={(event) => onEvidenceReferencesChange(event.target.value)}
                      placeholder="例如：完成说明第 2 段；C2 的链接第 3 项。"
                      className="min-h-24 rounded-md border border-rail bg-surface px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline"
                    />
                  </label>
                </>
              )}
              {message ? <p className="text-sm font-semibold text-clay">{message}</p> : null}
              <button
                type="button"
                disabled={isSubmitting || (mode === 'existing-evidence' && (evidenceAddition.trim().length < 20 || !evidencePredatesSubmission))}
                onClick={onSubmit}
                className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
              >
                <Bot size={17} aria-hidden="true" />
                {isSubmitting ? '正在复审' : '提交材料并复审'}
              </button>
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
  return [
    {
      id: contract.aiReview.id,
      kind: 'initial',
      review: contract.aiReview,
      aiConfig: contract.completionReviewAIConfig ?? contract.aiReview.aiConfig,
      createdAt: contract.aiReview.createdAt,
    },
  ]
}

export function CopyReviewStateButton({ contract, projectTitle }: { contract: ExecutionContract; projectTitle: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildReviewTranscript(contract, projectTitle, getReviewRounds(contract)))
      showSuccessToast('当前审查状态已复制')
    } catch {
      showErrorToast('复制失败，请检查浏览器权限。')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-1.5 border border-rail bg-surface px-2.5 text-xs font-semibold text-graphite transition hover:border-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline"
    >
      <Copy size={14} aria-hidden="true" />
      复制当前状态
    </button>
  )
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
      `审查配置：${
        [round.aiConfig ?? round.review.aiConfig]
          .filter(Boolean)
          .map((config) => `${config?.label} / ${config?.provider} / ${config?.model}`)
          .join('') || '未记录'
      }`,
      ...(round.clarification
        ? [
            `澄清标准：${round.clarification.criterionIds.join('、')}`,
            ...(round.clarification.explanation ? [`澄清说明：${round.clarification.explanation}`] : []),
            ...(round.clarification.evidenceReferences ? [`证据位置：${round.clarification.evidenceReferences}`] : []),
            ...(round.clarification.evidenceAddition
              ? [
                  `补交的既有证据（用户声明：${round.clarification.evidencePredatesSubmission ? '首次提交前已存在' : '未确认来源时间'}）：\n${round.clarification.evidenceAddition}`,
                ]
              : []),
          ]
        : []),
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

export function ReviewAIIdentity({ config }: { config?: AIConfigSnapshot }) {
  if (!config) return null
  return (
    <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-signal/35 pl-3 text-xs font-semibold text-graphite">
      <span>审查配置</span>
      <span className="text-ink">{config.label}</span>
      <span>{config.provider}</span>
      <span>{config.model}</span>
    </div>
  )
}

export function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-rail bg-surface p-4">
      <div className="font-mono text-xs font-semibold text-signal">{title}</div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{body}</p>
    </div>
  )
}

export function CompletionRecordSummary({
  record,
  contracts,
  closingContractId,
  currentContractId,
}: {
  record: CompletionRecord
  contracts: ExecutionContract[]
  closingContractId: string
  currentContractId: string
}) {
  const isClosingNode = closingContractId === currentContractId
  const isAccepted = isAcceptedRecord(record)
  return (
    <section className={`rounded-md border p-5 ${isAccepted ? 'border-moss/35 bg-moss/8' : 'border-graphite/30 bg-shell'}`}>
      <div className={`font-mono text-xs font-semibold uppercase ${isAccepted ? 'text-moss' : 'text-graphite'}`}>
        {isAccepted ? 'Accepted record' : 'Sealed record'}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{isAccepted ? '已纳入阶段验收成果' : '已封存，尚未验收'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">{record.summary}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-graphite">
        <span>覆盖 {record.coveredContractIds.length} 个推进节点</span>
        <span className={isAccepted ? 'text-moss' : 'text-graphite'}>{isAccepted ? 'AI 审查通过 · 用户确认' : 'AI 有缺口 · 用户封存'}</span>
        <span>
          {new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          }).format(new Date(record.createdAt))}
        </span>
      </div>
      <div className={`mt-4 border-t pt-4 ${isAccepted ? 'border-moss/20' : 'border-rail'}`}>
        <div className={`font-mono text-xs font-semibold ${isAccepted ? 'text-moss' : 'text-graphite'}`}>{isAccepted ? '本次验收范围' : '本次封存范围'}</div>
        <div className="mt-2 grid gap-1 text-sm text-graphite">
          {record.coveredContractIds.map((contractId) => (
            <span key={contractId}>{contracts.find((contract) => contract.id === contractId)?.title ?? '推进节点'}</span>
          ))}
        </div>
      </div>
      {!isClosingNode ? (
        <Link
          to={`/contracts/${closingContractId}`}
          className="mt-4 inline-flex items-center text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline"
        >
          打开收束节点
        </Link>
      ) : null}
    </section>
  )
}
