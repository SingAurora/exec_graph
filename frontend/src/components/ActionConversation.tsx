import { Bot, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'
import type { DraftReview, ExecutionContract } from '../types'

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
  supplementOfContractId?: string
  retryOfContractId?: string
  onCreate: (input: { draft: string; draftReview: DraftReview; planningConversationId: string }) => Promise<{ contractId?: string }>
}

export function PlanningConversation({ projectId, parentContractId, sourceContractIds, branchId, fork, closureSourceIds, supplementOfContractId, retryOfContractId, onCreate }: PlanningConversationProps) {
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
      method: 'POST', body: JSON.stringify({ parentContractId, sourceContractIds, branchId, fork, closureSourceIds, supplementOfContractId, retryOfContractId }),
    }).then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: Error) => { if (alive) setError(reason.message) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [token, projectId, parentContractId, sourceContractIds, branchId, fork, closureSourceIds, supplementOfContractId, retryOfContractId])

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
    <section className="space-y-5">
      <div className="rounded-md border border-rail bg-surface/72 p-5">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />目标对话</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">和 AI 定义这次推进</h2>
        <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto border-y border-rail py-4">
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

export function CompletionConversation({ projectId, contract }: { projectId: string; contract: ExecutionContract }) {
  const token = useExecStore((state) => state.accessToken)
  const refreshWorkspace = useExecStore((state) => state.refreshWorkspace)
  const submitCompletion = useExecStore((state) => state.submitCompletion)
  const [progress, setProgress] = useState('')
  const [claim, setClaim] = useState('')
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState<'progress' | 'review' | null>(null)
  const [error, setError] = useState('')

  const saveProgress = async () => {
    if (!progress.trim()) return
    setBusy('progress'); setError('')
    try {
      await requestConversation(token, `/api/projects/${projectId}/nodes/${contract.id}/work-logs`, { method: 'POST', body: JSON.stringify({ body: progress }) })
      setProgress(''); await refreshWorkspace()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存进展失败') }
    finally { setBusy(null) }
  }
  const submit = async () => {
    if (!claim.trim() || !evidence.trim()) return
    setBusy('review'); setError('')
    const result = await submitCompletion(contract.id, { completionClaim: claim, evidenceText: evidence })
    if (!result.success) setError(result.message ?? '提交验收失败')
    else { setClaim(''); setEvidence('') }
    setBusy(null)
  }
  const isSubmitted = Boolean(contract.completionClaim)
  return <section className="rounded-md border border-rail bg-surface/72 p-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} />工作与验收</div><h2 className="mt-2 font-display text-2xl font-semibold">先记录推进，再明确提交验收</h2><div className="mt-5 grid gap-5 border-y border-rail py-5 lg:grid-cols-2"><div><div className="text-sm font-semibold text-ink">保存进展</div><p className="mt-1 text-sm leading-6 text-graphite">研究发现、材料位置、遇到的阻碍和下一步都会保留，但不会调用 AI 审查。</p><textarea value={progress} onChange={(event) => setProgress(event.target.value)} disabled={Boolean(busy)} className="mt-3 min-h-28 w-full rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="例如：对比完两份食谱，发现炖煮时长差异很大；下一步查锅具对口感的影响。" /><button type="button" onClick={saveProgress} disabled={Boolean(busy) || !progress.trim()} className="mt-3 inline-flex h-10 items-center gap-2 border border-rail bg-surface px-3 text-sm font-semibold text-ink disabled:opacity-50"><Send size={16} />{busy === 'progress' ? '正在保存' : '保存进展'}</button></div><div className="border-t border-rail pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><div className="text-sm font-semibold text-ink">提交验收</div><p className="mt-1 text-sm leading-6 text-graphite">只有这一步会固定本轮说明和证据，并交给项目审查 AI。</p>{isSubmitted ? <div className="mt-4 border-l-2 border-signal py-2 pl-3 text-sm leading-6 text-graphite">本轮提交已固定。AI 结论与后续澄清会显示在下方；新增工作请建立补足行动。</div> : <><textarea value={claim} onChange={(event) => setClaim(event.target.value)} disabled={Boolean(busy)} className="mt-3 min-h-24 w-full rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="完成说明：这次实际产出了什么。" /><textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} disabled={Boolean(busy)} className="mt-3 min-h-24 w-full rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="逐条证据：C1 ...；C2 ...；材料链接、片段或观察记录。" /><button type="button" onClick={submit} disabled={Boolean(busy) || !claim.trim() || !evidence.trim()} className="mt-3 inline-flex h-10 items-center gap-2 bg-signal px-3 text-sm font-semibold text-white disabled:opacity-50"><Bot size={16} />{busy === 'review' ? 'AI 正在审查' : '提交给 AI 验收'}</button></>}</div></div>{contract.workLogs?.length ? <div className="mt-5 border-l border-rail pl-4">{contract.workLogs.map((log) => <div key={log.id} className="mb-4"><div className="font-mono text-xs font-semibold text-signal">进展记录 · {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.createdAt))}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-graphite">{log.body}</p></div>)}</div> : null}{error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}</section>
}
