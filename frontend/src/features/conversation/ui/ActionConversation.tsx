import { Bot, Copy, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import { openPlanningConversation, requestPlanningDraftFreezeReview, sendConversationMessage } from '@/features/conversation/api/client'
import { useWorkspaceStore } from '@/features/workspace/model/useWorkspaceStore'
import type { DraftReview, ExecutionContract } from '@/entities/execution-node/model/types'
import type { ActionConversation as Conversation, ActionDraft, ConversationMessage } from '@/features/conversation/model/types'

type CompletionDraft = {
  claim: string
  evidence: string
  startedAt: string
  endedAt: string
}

function completionDraftStorageKey(contractID: string) {
  return `exec-graph:completion-draft:${contractID}`
}

function loadCompletionDraft(contractID: string): CompletionDraft | null {
  try {
    const value = window.localStorage.getItem(completionDraftStorageKey(contractID))
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<CompletionDraft>
    return {
      claim: typeof parsed.claim === 'string' ? parsed.claim : '',
      evidence: typeof parsed.evidence === 'string' ? parsed.evidence : '',
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : '',
      endedAt: typeof parsed.endedAt === 'string' ? parsed.endedAt : '',
    }
  } catch {
    return null
  }
}

function saveCompletionDraft(contractID: string, draft: CompletionDraft) {
  try {
    const key = completionDraftStorageKey(contractID)
    if (!draft.claim && !draft.evidence && !draft.startedAt && !draft.endedAt) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // A private browsing context may deny storage. The form still works in memory.
  }
}

function clearCompletionDraft(contractID: string) {
  try {
    window.localStorage.removeItem(completionDraftStorageKey(contractID))
  } catch {
    // Storage cleanup is best-effort.
  }
}

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
  return `${transcript}\n\n# 当前行动草案\n\n## ${draft.title}\n\n**目标**\n\n${draft.verifiableGoal}\n\n**做到位清单**\n\n${draft.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}\n\n**记录要求**\n\n${draft.evidenceRequirement}`
}

export function PlanningConversation({ projectUuid, parentContractUuid, sourceContractUuids, branchUuid, fork, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid, onCreate }: PlanningConversationProps) {
  const navigate = useNavigate()
  const token = useWorkspaceStore((state) => state.accessToken)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'starting' | 'replying' | 'freezing' | null>('starting')

  useEffect(() => {
    let alive = true
    openPlanningConversation(token, { projectUuid, parentContractUuid, sourceContractUuids, branchUuid, fork, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid }).then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: Error) => { if (alive) setError(reason.message) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [token, projectUuid, parentContractUuid, sourceContractUuids, branchUuid, fork, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid])

  const send = async (freezeReview = false) => {
    if (!conversation || (!freezeReview && !body.trim())) return
    setBusy(freezeReview ? 'freezing' : 'replying'); setError('')
    try {
      const data = freezeReview
        ? await requestPlanningDraftFreezeReview(token, conversation.uuid)
        : await sendConversationMessage(token, conversation.uuid, body)
      setConversation(data.conversation); setBody('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AI 对话失败') }
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
  const copyTranscript = async () => {
    if (!conversation?.messages.length) return
    try {
      await navigator.clipboard.writeText(conversationTranscript(conversation.messages, draft))
      showSuccessToast('对话已复制')
    } catch {
      showErrorToast('复制失败，请检查浏览器权限。')
    }
  }
  return (
    <section className="space-y-5">
      <div className="rounded-md border border-rail bg-surface/72 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />目标对话</div><button type="button" onClick={copyTranscript} disabled={!conversation?.messages.length} className="inline-flex h-8 items-center gap-1.5 border border-rail bg-surface px-2.5 text-xs font-semibold text-graphite transition hover:border-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} aria-hidden="true" />复制对话</button></div>
        <h2 className="mt-2 font-display text-2xl font-semibold">和 AI 定义这次推进</h2>
        <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto border-y border-rail py-4">
          {conversation?.messages.length ? conversation.messages.map((message) => (
            <div key={message.uuid} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}>
              <div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI' : '你'}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p>
            </div>
          )) : <p className="text-sm text-graphite">描述你想推进的事情。AI 会逐步把它整理为可执行的行动。</p>}
          {busy ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在整理本轮对话</div> : null}
        </div>
        <div className="mt-4 flex gap-3">
          <AutoGrowingTextarea value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(busy)} className="min-h-24 flex-1 rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="例如：我想研究一道番茄牛腩，今晚做给四个人吃。" />
          <button type="button" onClick={() => send()} disabled={Boolean(busy) || !body.trim()} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} /></button>
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
      </div>
      <aside className="rounded-md border border-rail bg-shell p-5">
        <div className="font-mono text-xs font-semibold uppercase text-signal">行动草案</div>
        {draft ? <div className="mt-4 space-y-4 text-sm leading-6"><div><div className="font-semibold text-ink">{draft.title || '待定义标题'}</div><p className="mt-1 text-graphite">{draft.verifiableGoal || '待明确目标'}</p></div><div><div className="font-semibold text-ink">做到位清单</div><ul className="mt-1 list-disc space-y-1 pl-5 text-graphite">{draft.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div><div><div className="font-semibold text-ink">记录要求</div><p className="mt-1 text-graphite">{draft.evidenceRequirement}</p></div></div> : <p className="mt-4 text-sm leading-6 text-graphite">对话后，AI 会在这里持续更新行动草案。</p>}
        {conversation?.status === 'ready_for_freeze' ? <button type="button" onClick={freeze} disabled={Boolean(busy)} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white"><ShieldCheck size={17} />保存为推进节点</button> : <button type="button" onClick={() => send(true)} disabled={Boolean(busy) || !draft} className="mt-6 inline-flex h-11 w-full items-center justify-center border border-rail bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50">请求 AI 检查行动</button>}
      </aside>
    </section>
  )
}

export function CompletionConversation({ contract }: { contract: ExecutionContract }) {
  const reviewNodeCompletion = useWorkspaceStore((state) => state.reviewNodeCompletion)
  const [claim, setClaim] = useState('')
  const [evidence, setEvidence] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [hydratedContractID, setHydratedContractID] = useState('')
  const [busy, setBusy] = useState<'review' | null>(null)
  const [error, setError] = useState('')
  const isSubmitted = Boolean(contract.completionClaim)

  useEffect(() => {
    if (isSubmitted) {
      clearCompletionDraft(contract.uuid)
      setClaim('')
      setEvidence('')
      setStartedAt('')
      setEndedAt('')
      setHydratedContractID(contract.uuid)
      return
    }
    const draft = loadCompletionDraft(contract.uuid)
    setClaim(draft?.claim ?? '')
    setEvidence(draft?.evidence ?? '')
    setStartedAt(draft?.startedAt ?? '')
    setEndedAt(draft?.endedAt ?? '')
    setHydratedContractID(contract.uuid)
  }, [contract.uuid, isSubmitted])

  useEffect(() => {
    if (isSubmitted || hydratedContractID !== contract.uuid) return
    saveCompletionDraft(contract.uuid, { claim, evidence, startedAt, endedAt })
  }, [claim, contract.uuid, endedAt, evidence, hydratedContractID, isSubmitted, startedAt])

  const submit = async () => {
    if (!claim.trim() || !evidence.trim()) return
    if (startedAt && endedAt && new Date(endedAt) < new Date(startedAt)) {
      setError('结束时间不能早于开始时间')
      return
    }
    setBusy('review'); setError('')
    const result = await reviewNodeCompletion(contract.uuid, {
      completionClaim: claim,
      evidenceText: evidence,
      startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
      endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
    })
    if (!result.success) setError(result.message ?? '提交验收失败')
    else {
      clearCompletionDraft(contract.uuid)
      setClaim('')
      setEvidence('')
      setStartedAt('')
      setEndedAt('')
    }
    setBusy(null)
  }
  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />记录与分析</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">提交这次行动的结果</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">完成后填写事实和证据。开始、结束时间是可选的，填入后会出现在工作总览的日时间轴。</p>
      <div className="mt-5 grid gap-5 border-y border-rail py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2"><span className="text-sm font-semibold text-ink">开始时间（可选）</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} disabled={Boolean(busy) || isSubmitted} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal" /></label>
          <label className="grid gap-2"><span className="text-sm font-semibold text-ink">结束时间（可选）</span><input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} disabled={Boolean(busy) || isSubmitted} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal" /></label>
        </div>
        {isSubmitted ? <div className="border-l-2 border-signal py-2 pl-3 text-sm leading-6 text-graphite">本轮行动记录已固定。AI 的整理结果与后续说明会显示在下方；新的工作请建立下一步行动。</div> : <div className="grid gap-3"><label className="grid gap-2"><span className="text-sm font-semibold text-ink">实际行动说明</span><AutoGrowingTextarea value={claim} onChange={(event) => setClaim(event.target.value)} disabled={Boolean(busy)} className="min-h-24 w-full rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="这次实际做了什么？" /></label><label className="grid gap-2"><span className="text-sm font-semibold text-ink">观察与材料</span><AutoGrowingTextarea value={evidence} onChange={(event) => setEvidence(event.target.value)} disabled={Boolean(busy)} className="min-h-24 w-full rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="记录实际发生的变化、关键细节、阻碍或仍未知的部分。" /></label><button type="button" onClick={submit} disabled={Boolean(busy) || !claim.trim() || !evidence.trim()} className="inline-flex h-10 w-fit items-center gap-2 bg-signal px-3 text-sm font-semibold text-white disabled:opacity-50"><Bot size={16} />{busy === 'review' ? 'AI 正在整理' : '请求 AI 辅助分析'}</button></div>}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
    </section>
  )
}
