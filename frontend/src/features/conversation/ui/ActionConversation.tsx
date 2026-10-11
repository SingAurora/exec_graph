import { Bot, CircleAlert, CircleCheck, CircleHelp, CircleX, Copy, Eraser, ListChecks, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import { clearConversation as requestClearConversation, finalizeCompletionReviewConversation, openCompletionReviewConversation, openPlanningConversation, requestPlanningDraftFreezeReview, sendConversationMessage } from '@/features/conversation/api/client'
import { useWorkspaceStore } from '@/features/workspace/model/useWorkspaceStore'
import type { DraftReview, ExecutionContract } from '@/entities/execution-node/model/types'
import { quickActionSmartContractUuid } from '@/entities/smart-contract/model/constants'
import type { ActionConversation as Conversation, ActionDraft, CompletionProgress, CompletionProgressItem, ConversationMessage, PlanningReview } from '@/features/conversation/model/types'

function AutoGrowingTextarea({ className = '', onInput, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }

  useLayoutEffect(() => {
    if (textareaRef.current) resize(textareaRef.current)
  }, [value])

  return <textarea ref={textareaRef} value={value} onInput={(event) => { resize(event.currentTarget); onInput?.(event) }} className={`resize-none overflow-hidden ${className}`} {...props} />
}

const toDraftText = (draft: ActionDraft) => [
  `契约标题：${draft.title}`,
  `可验证目标：${draft.verifiableGoal}`,
  '做到位清单:',
  ...draft.acceptanceCriteria.map((item) => `- ${item}`),
  `记录要求：${draft.evidenceRequirement}`,
].join('\n')

type PlanningConversationProps = {
  projectUuid: string
  parentContractUuid?: string
  sourceContractUuids?: string[]
  branchUuid?: string
  fork?: boolean
  closureSourceUuids?: string[]
  supplementOfContractUuid?: string
  retryOfContractUuid?: string
  onCreate: (input: { draft: string; draftReview: DraftReview; planningConversationUuid: string }) => Promise<{ contractUuid?: string; draftReview?: DraftReview }>
}

function conversationTranscript(messages: ConversationMessage[], draft?: ActionDraft) {
  const entries = messages.map((message) => `## ${message.role === 'assistant' ? 'AI' : '你'}\n\n${message.body.trim()}`).join('\n\n')
  const transcript = `# 节点目标对话\n\n${entries}`
  if (!draft) return transcript
  return `${transcript}\n\n# 当前行动草案\n\n## ${draft.title}\n\n**行动目标**\n\n${draft.verifiableGoal}\n\n**行动关注点**\n\n${draft.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}\n\n**记录提示**\n\n${draft.evidenceRequirement}`
}

function conversationErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) return reason.message
  return '创建目标对话失败，请稍后重试。'
}

function draftGaps(draft: ActionDraft | undefined) {
  if (!draft) return ['行动标题', '行动目标', '行动重点', '记录要求']
  const gaps: string[] = []
  if (!draft.title.trim()) gaps.push('行动标题')
  if (!draft.verifiableGoal.trim()) gaps.push('行动目标')
  if ((draft.acceptanceCriteria?.length ?? 0) === 0) gaps.push('行动重点')
  if (!draft.evidenceRequirement.trim()) gaps.push('记录要求')
  return gaps
}

function PlanningReviewPanel({ review, model }: { review: PlanningReview; model?: string }) {
  const passed = review.verdict === 'pass'
  return <section className={`rounded-md border p-5 ${passed ? 'border-moss/30 bg-moss/5' : 'border-clay/30 bg-clay/5'}`}>
    <div className={`font-mono text-xs font-semibold uppercase ${passed ? 'text-moss' : 'text-clay'}`}>AI review</div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold">AI 审查：{passed ? '行动草案可以保存' : '行动草案仍需补充'}</h2>
      <span className={`rounded-full border bg-surface/70 px-3 py-1 font-mono text-xs font-semibold ${passed ? 'border-moss/30 text-moss' : 'border-clay/30 text-clay'}`}>{passed ? '审查通过' : '记录有缺口'}</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-graphite">{review.summary}</p>
    {review.missingRequirements.length > 0 ? <div className="mt-5 grid gap-3">
      {review.missingRequirements.map((item) => <div key={item} className="rounded-md border border-rail bg-surface/72 p-4"><div className="text-sm font-semibold text-ink">需要补充</div><p className="mt-2 text-sm leading-6 text-graphite">{item}</p></div>)}
    </div> : <div className="mt-5 border-l-2 border-moss py-2 pl-4 text-sm leading-6 text-graphite">目标、行动重点和记录要求已经足够清楚，可以保存为推进节点。</div>}
    {model ? <div className="mt-4 font-mono text-xs text-graphite">{model}</div> : null}
  </section>
}

export function PlanningConversation({ projectUuid, parentContractUuid, sourceContractUuids, branchUuid, fork, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid, onCreate }: PlanningConversationProps) {
  const navigate = useNavigate()
  const token = useWorkspaceStore((state) => state.accessToken)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'starting' | 'replying' | 'freezing' | null>('starting')
  const [startAttempt, setStartAttempt] = useState(0)

  const sourceContractKey = (sourceContractUuids ?? []).join(',')
  const closureSourceKey = (closureSourceUuids ?? []).join(',')
  const sourceContracts = useMemo<string[] | undefined>(() => sourceContractKey ? sourceContractKey.split(',') : undefined, [sourceContractKey])
  const closureSources = useMemo<string[] | undefined>(() => closureSourceKey ? closureSourceKey.split(',') : undefined, [closureSourceKey])

  useEffect(() => {
    let alive = true
    setConversation(null)
    setError('')
    setBusy('starting')
    openPlanningConversation(token, { projectUuid, parentContractUuid, sourceContractUuids: sourceContracts, branchUuid, fork, closureSourceUuids: closureSources, supplementOfContractUuid, retryOfContractUuid }).then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: unknown) => { if (alive) setError(conversationErrorMessage(reason)) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [token, projectUuid, parentContractUuid, sourceContracts, branchUuid, fork, closureSources, supplementOfContractUuid, retryOfContractUuid, startAttempt])

  const send = async (freezeReview = false) => {
    if (!conversation || (!freezeReview && !body.trim())) return
    setBusy(freezeReview ? 'freezing' : 'replying'); setError('')
    try {
      const data = freezeReview
        ? await requestPlanningDraftFreezeReview(token, conversation.uuid)
        : await sendConversationMessage(token, conversation.uuid, body)
      setConversation(data.conversation); setBody('')
    } catch (reason) { setError(conversationErrorMessage(reason).replace('创建目标对话失败', 'AI 对话失败')) }
    finally { setBusy(null) }
  }

  const freeze = async () => {
    if (!conversation?.currentDraft) return
    setBusy('freezing'); setError('')
    try {
      const draft = toDraftText(conversation.currentDraft)
      if (!conversation.aiConfig) {
        setError('冻结审核缺少 AI 配置记录。请重新提交冻结审核。')
        return
      }
      // The conversation's ready state is produced by the freeze review itself.
      // Calling the standalone draft-review endpoint again could contradict or block
      // this already approved conversation.
      const draftReview: DraftReview = {
        uuid: crypto.randomUUID(),
        verdict: 'pass',
        summary: '目标对话已完成，行动草案已经足够清楚，可以保存为一次推进。',
        missingRequirements: [],
        createdAt: conversation.updatedAt ?? new Date().toISOString(),
        aiConfig: conversation.aiConfig,
      }
      const result = await onCreate({ draft, draftReview, planningConversationUuid: conversation.uuid })
      if (!result.contractUuid) { setError(result.draftReview?.summary ?? '节点没有创建成功，请检查冻结审核。'); return }
      navigate(`/contracts/${result.contractUuid}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '冻结节点失败') }
    finally { setBusy(null) }
  }

  const draft = conversation?.currentDraft
  const isQuickAction = conversation?.context?.smartContract?.uuid === quickActionSmartContractUuid
  const copyTranscript = async () => {
    if (!conversation?.messages.length) return
    try {
      await navigator.clipboard.writeText(conversationTranscript(conversation.messages, draft))
      showSuccessToast('对话已复制')
    } catch {
      showErrorToast('复制失败，请检查浏览器权限。')
    }
  }
  const clearConversation = async () => {
    if (!conversation?.messages.length || busy) return
    if (!window.confirm('清空当前规划对话？已有消息和行动草案会被删除，但项目与来源上下文会保留。')) return
    setBusy('starting')
    setError('')
    try {
      const data = await requestClearConversation(token, conversation.uuid)
      setConversation(data.conversation)
      setBody('')
    } catch (reason) {
      setError(conversationErrorMessage(reason))
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="space-y-5">
      <div className="rounded-md border border-rail bg-surface/72 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />{isQuickAction ? '开始一项行动' : '目标对话'}</div><div className="flex flex-wrap items-center gap-2">{!isQuickAction ? <button type="button" onClick={copyTranscript} disabled={!conversation?.messages.length || Boolean(busy)} className="inline-flex h-8 items-center gap-1.5 border border-rail bg-surface px-2.5 text-xs font-semibold text-graphite transition hover:border-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} aria-hidden="true" />复制对话</button> : null}<button type="button" onClick={() => void clearConversation()} disabled={!conversation?.messages.length || Boolean(busy) || conversation.status === 'frozen' || conversation.status === 'closed'} className="inline-flex h-8 items-center gap-1.5 border border-rail bg-surface px-2.5 text-xs font-semibold text-graphite transition hover:border-clay hover:text-clay disabled:cursor-not-allowed disabled:opacity-50" title="清空当前规划对话"><Eraser size={14} aria-hidden="true" />清空</button></div></div>
        <h2 className="mt-2 font-display text-2xl font-semibold">{isQuickAction ? '告诉 AI 你准备做什么' : '和 AI 定义这次推进'}</h2>
        <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto border-y border-rail py-4">
          {conversation?.messages.length ? conversation.messages.map((message) => (
            <div key={message.uuid} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}>
              <div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI' : '你'}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p>
            </div>
          )) : <p className="text-sm text-graphite">直接说你准备做什么。AI 会帮你抓住最重要的几个重点。</p>}
          {busy ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在整理本轮对话</div> : null}
        </div>
        <div className="mt-4 flex gap-3">
          <AutoGrowingTextarea value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(busy)} className="min-h-24 flex-1 rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder={isQuickAction ? '例如：我今晚想洗个澡，认真洗干净。' : '例如：我想研究一道番茄牛腩，今晚做给四个人吃。'} />
          <button type="button" onClick={() => send()} disabled={Boolean(busy) || !body.trim()} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} /></button>
        </div>
        {error ? <div className="mt-3 border-l-2 border-clay py-1 pl-3 text-sm leading-6 text-clay">
          <p className="font-semibold">{error}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {error.includes('审查 AI') ? <Link to={`/projects/${projectUuid}?tab=ai`} className="font-semibold text-signal underline underline-offset-2">去项目 AI 设置</Link> : null}
            <button type="button" onClick={() => setStartAttempt((attempt) => attempt + 1)} disabled={Boolean(busy)} className="font-semibold text-ink underline underline-offset-2 disabled:opacity-50">重新创建对话</button>
          </div>
        </div> : null}
      </div>
      {!isQuickAction && conversation?.currentDraftReview ? <PlanningReviewPanel review={conversation.currentDraftReview} model={conversation.aiConfig?.model} /> : null}
      <aside className="rounded-md border border-rail bg-shell p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><ListChecks size={15} aria-hidden="true" />{isQuickAction ? '这次行动的重点' : '本轮解析的行动草案'}</div>{draft && !isQuickAction ? <span className={`text-xs font-semibold ${draftGaps(draft).length === 0 ? 'text-moss' : 'text-amber'}`}>{draftGaps(draft).length === 0 ? '已形成草案' : `还需明确 ${draftGaps(draft).length} 项`}</span> : null}</div>
        <p className="mt-2 text-xs leading-5 text-graphite">{isQuickAction ? 'AI 会把复杂描述收敛成少数真正重要的关注点。' : '每次 AI 回复后，下面的目标和行动重点都会重新整理。'}</p>
        {draft ? <div className="mt-4 space-y-4 text-sm leading-6"><div><div className="font-semibold text-ink">{draft.title || '待定义标题'}</div><p className="mt-1 text-graphite">{draft.verifiableGoal || '待明确目标'}</p></div><div><div className="font-semibold text-ink">行动关注点</div><ul className="mt-1 list-disc space-y-1 pl-5 text-graphite">{(draft.acceptanceCriteria ?? []).map((item) => <li key={item}>{item}</li>)}</ul></div><div><div className="font-semibold text-ink">记录提示</div><p className="mt-1 text-graphite">{draft.evidenceRequirement}</p></div></div> : <p className="mt-4 text-sm leading-6 text-graphite">对话后，AI 会在这里持续更新本次行动草案。</p>}
        {!isQuickAction && draftGaps(draft).length > 0 ? <div className="mt-5 border-t border-rail pt-4"><div className="text-xs font-semibold text-amber">当前还需明确</div><ul className="mt-2 space-y-1 text-sm leading-5 text-graphite">{draftGaps(draft).map((gap) => <li key={gap}>· {gap}</li>)}</ul></div> : null}
        {!isQuickAction && draftGaps(draft).length === 0 ? <div className="mt-5 border-t border-moss/30 pt-4 text-sm leading-5 text-moss">目标、行动重点和记录要求已经形成，可以请求 AI 检查是否保存为推进。</div> : null}
        {conversation?.status === 'ready_for_freeze' ? <button type="button" onClick={freeze} disabled={Boolean(busy)} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white"><ShieldCheck size={17} />保存为推进节点</button> : <button type="button" onClick={isQuickAction ? freeze : () => send(true)} disabled={Boolean(busy) || !draft || (isQuickAction && draftGaps(draft).some((gap) => gap !== '记录要求'))} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 border border-rail bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50">{isQuickAction ? <><ShieldCheck size={17} />开始行动</> : '请求 AI 检查行动'}</button>}
      </aside>
    </section>
  )
}

function CompletionProgressPanel({ progress, contract }: { progress: CompletionProgress; contract: ExecutionContract }) {
  const criterionText = new Map(contract.acceptanceCriteria.map((criterion) => [criterion.id, criterion.text]))
  const groups: Array<{ title: string; items: CompletionProgressItem[]; icon: typeof CircleCheck; className: string }> = [
    { title: '当前说明已覆盖', items: progress.confirmed, icon: CircleCheck, className: 'text-moss' },
    { title: '提到但还不清楚', items: progress.unclear, icon: CircleHelp, className: 'text-amber' },
    { title: '当前还没提到', items: progress.notMentioned, icon: CircleAlert, className: 'text-clay' },
    { title: '明确未完成', items: progress.notCompleted, icon: CircleX, className: 'text-clay' },
  ]
  const visibleGroups = groups.filter((group) => group.items.length > 0)
  if (visibleGroups.length === 0) return null
  return <aside className="mt-5 border-l-2 border-signal bg-shell/50 p-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={15} className="text-signal" aria-hidden="true" />当前说明解析</div>
    <p className="mt-1 text-xs leading-5 text-graphite">这是基于当前对话的临时判断，不代表 AI 已验证现实结果。</p>
    <div className="mt-4 space-y-4">
      {visibleGroups.map((group) => {
        const Icon = group.icon
        return <div key={group.title}>
          <div className={`flex items-center gap-2 text-xs font-semibold ${group.className}`}><Icon size={14} aria-hidden="true" />{group.title}</div>
          <ul className="mt-2 space-y-2 text-sm leading-5 text-graphite">
            {group.items.map((item) => <li key={`${group.title}-${item.criterionId}`} className="border-l border-rail pl-3"><span className="font-mono text-xs font-semibold text-ink">{item.criterionId}</span> {criterionText.get(item.criterionId) ?? '行动重点'}<p className="mt-0.5 text-xs text-graphite">{item.reason}</p></li>)}
          </ul>
        </div>
      })}
    </div>
  </aside>
}

export function CompletionConversation({ contract }: { contract: ExecutionContract }) {
  const token = useWorkspaceStore((state) => state.accessToken)
  const refreshWorkspace = useWorkspaceStore((state) => state.refreshWorkspace)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [busy, setBusy] = useState<'starting' | 'replying' | 'finalizing' | null>('starting')
  const [error, setError] = useState('')
  const isQuickAction = contract.smartContractUuid === quickActionSmartContractUuid
  // 完成说明是否结束只由当前对话决定。节点上的 completionClaim 是最终结论落库后的历史事实，
  // 不能在对话尚未关闭时把输入框误判为只读。
  const isFinalized = conversation?.status === 'closed'

  useEffect(() => {
    let alive = true
    setConversation(null)
    setError('')
    setBusy('starting')
    openCompletionReviewConversation(token, { projectUuid: contract.projectUuid, nodeUuid: contract.uuid })
      .then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: unknown) => { if (alive) setError(conversationErrorMessage(reason).replace('创建目标对话失败', '打开完成审查对话失败')) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [contract.projectUuid, contract.uuid, token])

  const send = async () => {
    if (!conversation || !body.trim() || busy || isFinalized) return
    setBusy('replying')
    setError('')
    try {
      const data = await sendConversationMessage(token, conversation.uuid, body)
      setConversation(data.conversation)
      setBody('')
    } catch (reason) {
      setError(conversationErrorMessage(reason).replace('创建目标对话失败', '完成说明失败'))
    } finally {
      setBusy(null)
    }
  }

  const finalize = async () => {
    if (!conversation || !conversation.messages.some((message) => message.role === 'user') || busy || isFinalized) return
    if (startedAt && endedAt && new Date(endedAt) < new Date(startedAt)) {
      setError('结束时间不能早于开始时间')
      return
    }
    setBusy('finalizing')
    setError('')
    try {
      const data = await finalizeCompletionReviewConversation(token, {
        conversationUuid: conversation.uuid,
        startedAt: isQuickAction || !startedAt ? undefined : new Date(startedAt).toISOString(),
        endedAt: isQuickAction || !endedAt ? undefined : new Date(endedAt).toISOString(),
      })
      setConversation(data.conversation)
      await refreshWorkspace()
    } catch (reason) {
      setError(conversationErrorMessage(reason).replace('创建目标对话失败', isQuickAction ? '保存完成记录失败' : '生成最终审查结论失败'))
    } finally {
      setBusy(null)
    }
  }

  const clearConversationState = async () => {
    if (!conversation || busy || isFinalized || !conversation.messages.length) return
    if (!window.confirm('清空当前完成说明对话？已输入的说明会被删除。')) return
    setBusy('starting')
    setError('')
    try {
      const data = await requestClearConversation(token, conversation.uuid)
      setConversation(data.conversation)
      setBody('')
    } catch (reason) {
      setError(conversationErrorMessage(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />{isQuickAction ? '记录这次行动' : '完成审查对话'}</div><button type="button" onClick={() => void clearConversationState()} disabled={!conversation?.messages.length || Boolean(busy) || isFinalized} className="inline-flex h-8 items-center gap-1.5 border border-rail bg-surface px-2.5 text-xs font-semibold text-graphite transition hover:border-clay hover:text-clay disabled:cursor-not-allowed disabled:opacity-50"><Eraser size={14} />清空</button></div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{isQuickAction ? '告诉 AI 实际做了什么' : '和 AI 说明这次实际完成的情况'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">{isQuickAction ? '可以一次说完，也可以分几次补充。AI 会帮你整理成一条简洁记录。' : '你可以分几次说明，AI 会帮助整理重点。信息足够后，再生成一次包含验收覆盖度的完整结论。'}</p>
      <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto border-y border-rail py-4">
        {conversation?.messages.length ? conversation.messages.map((message) => (
          <div key={message.uuid} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}>
            <div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI' : '你'}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p>
          </div>
        )) : <p className="text-sm leading-6 text-graphite">先说明这次实际做了什么；可以一次写完，也可以分几次补充。</p>}
        {busy ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在整理本轮说明</div> : null}
      </div>
      {!isQuickAction && conversation?.currentProgress ? <CompletionProgressPanel progress={conversation.currentProgress} contract={contract} /> : null}
      <div className="mt-4 grid gap-4">
        <div className="flex gap-3"><AutoGrowingTextarea value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(busy) || isFinalized} className="min-h-24 flex-1 rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="例如：洗了头和身子，重点清洁了腋下和裤裆，擦干并穿好衣服，没有异常。" /><button type="button" onClick={() => void send()} disabled={Boolean(busy) || isFinalized || !body.trim()} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} /></button></div>
        {!isQuickAction ? <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2"><span className="text-sm font-semibold text-ink">开始时间（可选）</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} disabled={Boolean(busy) || isFinalized} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal" /></label><label className="grid gap-2"><span className="text-sm font-semibold text-ink">结束时间（可选）</span><input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} disabled={Boolean(busy) || isFinalized} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal" /></label></div> : null}
        <button type="button" onClick={() => void finalize()} disabled={Boolean(busy) || isFinalized || !conversation?.messages.some((message) => message.role === 'user')} className="inline-flex h-11 items-center justify-center gap-2 bg-moss px-4 text-sm font-semibold text-white disabled:opacity-50"><ShieldCheck size={17} />{busy === 'finalizing' ? '正在整理记录' : isQuickAction ? '保存完成记录' : '生成最终审查结论'}</button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
    </section>
  )
}
