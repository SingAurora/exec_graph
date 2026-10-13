import { ArrowLeft, FileText, MessageCircle, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ActionTopic, ArchiveTab, ChatMessage, CompletionNode, PlanNode, Project } from '../shared/model'
import { MarkdownDocument } from '../widgets/ai/MarkdownDocument'

type NodeArchivePageProps = {
  project: Project
  topic?: ActionTopic
  plan: PlanNode
  completion?: CompletionNode
  initialTab: ArchiveTab
  onBack: () => void
}

export function NodeArchivePage({ project, topic, plan, completion, initialTab, onBack }: NodeArchivePageProps) {
  const [tab, setTab] = useState<ArchiveTab>(initialTab)

  useEffect(() => setTab(initialTab), [initialTab, plan.id])

  return <section className="max-w-[860px] pt-[38px] max-[700px]:pt-7">
    <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />回到项目楼</button>
    <header className="border-b border-line py-7 pb-6"><span className="section-kicker">本楼资料</span><h2 className="mt-[7px] text-[27px] tracking-[-.04em]">{plan.title}</h2><p className="mt-2 text-[12px] text-muted">{project.title} · {topic?.title ?? '项目执行'} · {plan.authorId}</p></header>
    <div className="mt-[25px] inline-flex rounded-md border border-line bg-paper p-0.5" role="tablist" aria-label="楼层资料类型"><button className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-[11px] font-bold ${tab === 'plan' ? 'bg-signal text-white' : 'text-muted'}`} type="button" role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}><FileText size={14} />计划 Markdown</button><button className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-[11px] font-bold ${tab === 'history' ? 'bg-signal text-white' : 'text-muted'}`} type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}><MessageCircle size={14} />AI 对话记录</button></div>
    {tab === 'plan' ? <div className="mt-4 border border-line bg-surface"><MarkdownDocument markdown={plan.markdown} label="计划 Markdown" empty="计划文档尚未生成。" /></div> : <div className="mt-4 border-y border-line"><ConversationSection label="连续 AI 对话" messages={completion?.conversation ?? plan.conversation} empty={completion ? '这楼暂时没有保存连续 AI 对话。' : '这楼暂时没有保存计划阶段的 AI 对话。'} /></div>}
  </section>
}

function ConversationSection({ label, messages, empty }: { label: string; messages?: ChatMessage[]; empty: string }) {
  return <section className="border-b border-line last:border-b-0"><header className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-signal-soft text-signal"><Sparkles size={14} /></span><h3 className="text-[15px]">{label}</h3></div><span className="text-[10px] text-muted">{messages?.length ? `${messages.length} 条消息` : '暂无记录'}</span></header>{messages?.length ? <div className="grid gap-3 border-t border-line px-5 py-5">{messages.map((message) => <ConversationMessage key={message.id} message={message} />)}</div> : <p className="border-t border-line px-5 py-5 text-[13px] text-muted">{empty}</p>}</section>
}

function ConversationMessage({ message }: { message: ChatMessage }) {
  const isUser = message.speaker === 'user'
  return <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] border px-3.5 py-3 text-[13px] leading-[1.7] ${isUser ? 'border-signal bg-signal text-white' : 'border-line bg-paper text-ink'}`}><div className={`mb-1 text-[10px] font-bold ${isUser ? 'text-white/75' : 'text-signal'}`}>{isUser ? '你' : 'ExecG AI'}</div><p>{message.body}</p></div></div>
}
