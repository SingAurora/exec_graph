import { Bot, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'
import type { DraftReview } from '../types'

type ActionDraft = {
  title: string
  verifiableGoal: string
  acceptanceCriteria: string[]
  evidenceRequirement: string
}

type ConversationMessage = { id: string; role: 'user' | 'assistant'; body: string; createdAt: string }
type Conversation = {
  id: string
  phase: 'planning' | 'completion'
  status: string
  currentDraft?: ActionDraft
  messages: ConversationMessage[]
}

const toDraftText = (draft: ActionDraft) => [
  `契约标题：${draft.title}`,
  `可验证目标：${draft.verifiableGoal}`,
  '验收标准:',
  ...draft.acceptanceCriteria.map((item) => `- ${item}`),
  `证据要求：${draft.evidenceRequirement}`,
].join('\n')

async function requestConversation<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? `请求失败（HTTP ${response.status}）`)
  return data
}

type PlanningConversationProps = {
  projectId: string
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
  closureSourceIds?: string[]
  onCreate: (input: { draft: string; draftReview: DraftReview; planningConversationId: string }) => Promise<{ contractId?: string }>
}

export function PlanningConversation({ projectId, parentContractId, sourceContractIds, branchId, fork, closureSourceIds, onCreate }: PlanningConversationProps) {
  const navigate = useNavigate()
  const token = useExecStore((state) => state.accessToken)
  const reviewNodeDraft = useExecStore((state) => state.reviewNodeDraft)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'starting' | 'replying' | 'freezing' | null>('starting')

  useEffect(() => {
    let alive = true
    requestConversation<{ conversation: Conversation }>(token, `/api/projects/${projectId}/planning-conversations`, {
      method: 'POST', body: JSON.stringify({ parentContractId, sourceContractIds, branchId, fork, closureSourceIds }),
    }).then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: Error) => { if (alive) setError(reason.message) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [token, projectId, parentContractId, sourceContractIds, branchId, fork, closureSourceIds])

  const send = async (freezeReview = false) => {
    if (!conversation || (!freezeReview && !body.trim())) return
    setBusy(freezeReview ? 'freezing' : 'replying'); setError('')
    try {
      const data = await requestConversation<{ conversation: Conversation }>(token, `/api/conversations/${conversation.id}/${freezeReview ? 'freeze-review' : 'messages'}`, {
        method: 'POST', body: freezeReview ? undefined : JSON.stringify({ body }),
      })
      setConversation(data.conversation); setBody('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AI 对话失败') }
    finally { setBusy(null) }
  }

  const freeze = async () => {
    if (!conversation?.currentDraft) return
    setBusy('freezing'); setError('')
    try {
      const draft = toDraftText(conversation.currentDraft)
      const { draftReview } = await reviewNodeDraft({ projectId, draft })
      if (draftReview.verdict !== 'pass') { setError(draftReview.missingRequirements.join(' ') || draftReview.summary); return }
      const result = await onCreate({ draft, draftReview, planningConversationId: conversation.id })
      if (!result.contractId) { setError('节点没有创建成功，请检查冻结审核。'); return }
      navigate(`/contracts/${result.contractId}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '冻结节点失败') }
    finally { setBusy(null) }
  }

  const draft = conversation?.currentDraft
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-md border border-rail bg-surface/72 p-5">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />目标对话</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">和 AI 定义这次推进</h2>
        <div className="mt-5 max-h-[440px] space-y-4 overflow-y-auto border-y border-rail py-4">
          {conversation?.messages.length ? conversation.messages.map((message) => (
            <div key={message.id} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}>
              <div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI' : '你'}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p>
            </div>
          )) : <p className="text-sm text-graphite">描述你想推进的事情。AI 会逐步把它整理为可冻结的行动契约。</p>}
          {busy ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在整理本轮对话</div> : null}
        </div>
        <div className="mt-4 flex gap-3">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(busy)} className="min-h-24 flex-1 rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="例如：我想研究一道番茄牛腩，今晚做给四个人吃。" />
          <button type="button" onClick={() => send()} disabled={Boolean(busy) || !body.trim()} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} /></button>
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
      </div>
      <aside className="rounded-md border border-rail bg-shell p-5">
        <div className="font-mono text-xs font-semibold uppercase text-signal">行动契约草案</div>
        {draft ? <div className="mt-4 space-y-4 text-sm leading-6"><div><div className="font-semibold text-ink">{draft.title || '待定义标题'}</div><p className="mt-1 text-graphite">{draft.verifiableGoal || '待明确可验证目标'}</p></div><div><div className="font-semibold text-ink">验收标准</div><ul className="mt-1 list-disc space-y-1 pl-5 text-graphite">{draft.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div><div><div className="font-semibold text-ink">证据要求</div><p className="mt-1 text-graphite">{draft.evidenceRequirement}</p></div></div> : <p className="mt-4 text-sm leading-6 text-graphite">对话后，AI 会在这里持续更新草案。</p>}
        {conversation?.status === 'ready_for_freeze' ? <button type="button" onClick={freeze} disabled={Boolean(busy)} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white"><ShieldCheck size={17} />冻结为推进节点</button> : <button type="button" onClick={() => send(true)} disabled={Boolean(busy) || !draft} className="mt-6 inline-flex h-11 w-full items-center justify-center border border-rail bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50">提交冻结审核</button>}
      </aside>
    </section>
  )
}

export function CompletionConversation({ projectId, nodeId }: { projectId: string; nodeId: string }) {
  const token = useExecStore((state) => state.accessToken)
  const refreshWorkspace = useExecStore((state) => state.refreshWorkspace)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; requestConversation<{ conversation: Conversation }>(token, `/api/projects/${projectId}/nodes/${nodeId}/completion-conversations`, { method: 'POST' }).then((data) => { if (alive) setConversation(data.conversation) }).catch((reason: Error) => { if (alive) setError(reason.message) }).finally(() => { if (alive) setBusy(false) }); return () => { alive = false } }, [token, projectId, nodeId])
  const send = async () => { if (!conversation || !body.trim()) return; setBusy(true); setError(''); try { const data = await requestConversation<{ conversation: Conversation }>(token, `/api/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); setConversation(data.conversation); setBody(''); await refreshWorkspace() } catch (reason) { setError(reason instanceof Error ? reason.message : 'AI 审查失败') } finally { setBusy(false) } }
  return <section className="rounded-md border border-rail bg-surface/72 p-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />证据审查对话</div><h2 className="mt-2 font-display text-2xl font-semibold">逐轮提交完成说明与证据</h2><div className="mt-5 max-h-[380px] space-y-4 overflow-y-auto border-y border-rail py-4">{conversation?.messages.length ? conversation.messages.map((message) => <div key={message.id} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}><div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI 审查' : '你'}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p></div>) : <p className="text-sm leading-6 text-graphite">提交完成说明、证据位置，或补充解释 AI 可能误读的已有证据。</p>}{busy ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在按冻结规则审查</div> : null}</div><div className="mt-4 flex gap-3"><textarea value={body} onChange={(event) => setBody(event.target.value)} disabled={busy} className="min-h-24 flex-1 rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder={'说明本次完成了什么，并逐条写明 C1、C2 对应的证据位置。'} /><button type="button" onClick={send} disabled={busy || !body.trim()} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} /></button></div>{error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}</section>
}
