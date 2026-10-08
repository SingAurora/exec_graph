import { Bot, Send, ShieldCheck, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { finalizeTaskRequirementRevisionConversation, openTaskRequirementRevisionConversation, requestPlanningDraftFreezeReview, sendConversationMessage } from '@/features/conversation/api/client'
import type { ActionConversation as Conversation } from '@/features/conversation/model/types'
import { useWorkspaceStore } from '@/features/workspace/model/useWorkspaceStore'

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message.trim() ? reason.message : '任务要求修改失败，请稍后重试。'
}

/** 通过多轮 AI 对话修改未固定行动的任务要求，不提供任务点直接编辑入口。 */
export function RequirementRevisionConversation({ projectUuid, nodeUuid, onSaved }: { projectUuid: string; nodeUuid: string; onSaved: () => Promise<void> }) {
  const token = useWorkspaceStore((state) => state.accessToken)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState<'starting' | 'replying' | 'freezing' | 'saving' | null>('starting')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setBusy('starting')
    setError('')
    openTaskRequirementRevisionConversation(token, { projectUuid, nodeUuid })
      .then((data) => { if (alive) setConversation(data.conversation) })
      .catch((reason: unknown) => { if (alive) setError(errorText(reason)) })
      .finally(() => { if (alive) setBusy(null) })
    return () => { alive = false }
  }, [nodeUuid, projectUuid, token])

  const send = async (freeze = false) => {
    if (!conversation || (!freeze && !body.trim()) || busy) return
    setBusy(freeze ? 'freezing' : 'replying')
    setError('')
    try {
      const data = freeze
        ? await requestPlanningDraftFreezeReview(token, conversation.uuid)
        : await sendConversationMessage(token, conversation.uuid, body)
      setConversation(data.conversation)
      setBody('')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!conversation || conversation.status !== 'ready_for_freeze' || busy) return
    setBusy('saving')
    setError('')
    try {
      await finalizeTaskRequirementRevisionConversation(token, conversation.uuid)
      await onSaved()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-md border border-clay/30 bg-clay/5 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-clay"><Bot size={15} aria-hidden="true" />修改行动要求</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">和 AI 重新整理这次行动</h2>
      <p className="mt-2 text-sm leading-6 text-graphite">只能通过对话修改。确认新要求后，原完成说明和完成审查会被清空，需要重新说明实际完成情况。</p>
      <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto border-y border-rail py-4">
        {conversation?.messages.length ? conversation.messages.map((message) => (
          <div key={message.uuid} className={message.role === 'assistant' ? 'border-l-2 border-signal pl-4' : 'border-l-2 border-rail pl-4'}>
            <div className="font-mono text-xs font-semibold text-signal">{message.role === 'assistant' ? 'AI' : '你'}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{message.body}</p>
          </div>
        )) : <p className="text-sm leading-6 text-graphite">说明你想改变什么，或者哪些要求不再适用。</p>}
        {busy === 'starting' || busy === 'replying' || busy === 'freezing' ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin text-signal" />AI 正在整理</div> : null}
      </div>
      <div className="mt-4 flex gap-3">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(busy) || conversation?.status === 'ready_for_freeze'} className="min-h-24 flex-1 resize-y rounded-md border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="例如：这次只关注洗澡是否认真完成，不需要记录水温和情绪。" />
        <button type="button" onClick={() => void send()} disabled={Boolean(busy) || !body.trim() || conversation?.status === 'ready_for_freeze'} className="grid size-11 shrink-0 place-items-center self-end rounded-md bg-signal text-white disabled:opacity-50" title="发送给 AI"><Send size={17} aria-hidden="true" /></button>
      </div>
      {conversation?.status === 'ready_for_freeze' ? <button type="button" onClick={() => void save()} disabled={Boolean(busy)} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 bg-moss px-4 text-sm font-semibold text-white disabled:opacity-50"><ShieldCheck size={17} aria-hidden="true" />{busy === 'saving' ? '正在保存新要求' : '确认新的任务要求'}</button> : <button type="button" onClick={() => void send(true)} disabled={Boolean(busy) || !conversation?.currentDraft} className="mt-4 inline-flex h-11 w-full items-center justify-center border border-rail bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50">请求 AI 检查新要求</button>}
      {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
    </section>
  )
}
