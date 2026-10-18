import { ArrowLeft, ArrowUp, Check, LoaderCircle, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import { generateAIDocument, type AIConversationTurn } from '../../features/ai-key/api/chat'
import type { ChatMessage } from '../../shared/model'
import { Avatar } from '../../shared/ui/Avatar'
import { MarkdownDocument } from './MarkdownDocument'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'

type ActionWorkspaceProps = { profileName: string; aiConfig?: AIKeyConfig; contextTitle?: string; contextGuide?: string; inheritedExpression?: string; initialDocument?: string; initialMessages?: ChatMessage[]; onBack: () => void; onConfirm: (markdown: string, details: { title: string; description: string; points: string[]; note: string }, messages: ChatMessage[], expressionMarkdown?: string) => void }

export function ActionWorkspace({ profileName, aiConfig, contextTitle, contextGuide, inheritedExpression = '', initialDocument = '', initialMessages, onBack, onConfirm }: ActionWorkspaceProps) {
  const welcome: ChatMessage = { id: 'welcome', speaker: 'ai', body: `${contextTitle ? `你正在记录「${contextTitle}」之后发生的行动。` : ''}先说说这次实际做了什么。${contextGuide ? ` 这张行动图的 AI 对话指引会关注：${contextGuide}` : ''}` }
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages?.length ? initialMessages : [welcome])
  const [input, setInput] = useState('')
  const [document, setDocument] = useState(initialDocument)
  const [details, setDetails] = useState({ title: '', description: '', points: [] as string[], note: '' })
  const [sending, setSending] = useState(false)
  const [expressionMode, setExpressionMode] = useState<'inherit' | 'update' | 'clear'>('inherit')
  const [expressionDraft, setExpressionDraft] = useState<string>()
  const expressionText = expressionDraft ?? details.note
  const expressionMarkdown = expressionMode === 'inherit' ? undefined : expressionMode === 'clear' ? '' : expressionText.trim()
  const send = async (event: FormEvent) => {
    event.preventDefault(); const clean = input.trim(); if (!clean || sending) return
    const next = [...messages, { id: `user-${Date.now()}`, speaker: 'user' as const, body: clean }]; setMessages(next); setInput(''); setSending(true)
    try { if (!aiConfig) throw new Error('还没有可用的 AI 配置，请先前往设置。'); const turns: AIConversationTurn[] = next.filter((message) => message.id !== 'welcome').map((message) => ({ role: message.speaker === 'ai' ? 'assistant' : 'user', content: message.body })); const result = await generateAIDocument({ config: aiConfig, mode: 'action', turns, currentDocument: document, contextGuide }); setDocument(result.document); setDetails(result.details); setMessages((current) => [...current, { id: `ai-${Date.now()}`, speaker: 'ai', body: result.reply }]) } catch (error) { setMessages((current) => [...current, { id: `error-${Date.now()}`, speaker: 'ai', body: `暂时无法更新记录：${error instanceof Error ? error.message : '请求失败，请稍后重试。'}` }]) } finally { setSending(false) }
  }
  return <section className="pt-[22px]" aria-label="记录行动"><header className="flex min-h-[46px] items-center gap-3"><button className="icon-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={17} /></button><div><span className="section-kicker">行动节点</span><h2 className="mt-[3px] text-xl tracking-[-.03em]">记录一次真实行动</h2></div><span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-signal"><Sparkles size={14} />AI 整理</span></header><div className="mt-[22px] grid min-h-[620px] grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] border border-line bg-surface max-[700px]:block"><div className="flex min-w-0 flex-col border-r border-line max-[700px]:border-r-0"><div className="flex gap-2.5 border-b border-line px-5 py-[19px]"><span className="grid size-8 flex-none place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={15} /></span><div><strong className="text-[13px]">ExAct AI</strong><p className="mt-[3px] text-[11px] text-muted">帮你把已经发生的行动整理成可回看的记录。</p></div></div><div className="grid flex-1 content-start gap-4 overflow-auto px-5 py-[22px]">{messages.map((message) => <div className={`flex max-w-[90%] items-end gap-2 ${message.speaker === 'user' ? 'ml-auto flex-row-reverse' : ''}`} key={message.id}>{message.speaker === 'ai' && <span className="grid size-[25px] flex-none place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={13} /></span>}<div className={`rounded-[12px_12px_12px_3px] border border-line bg-paper px-3 py-2.5 text-[13px] leading-[1.65] ${message.speaker === 'user' ? 'rounded-[12px_12px_3px_12px] border-signal bg-signal text-on-signal' : ''}`}>{message.body}</div>{message.speaker === 'user' && <Avatar label={profileName.slice(0, 1)} size="small" />}</div>)}{sending && <div className="flex items-center gap-2 text-[12px] text-muted"><LoaderCircle size={14} className="animate-spin" />正在整理</div>}</div><form className="mx-3.5 mb-3.5 flex items-end gap-[9px] rounded-lg border border-line bg-paper px-3 py-2" onSubmit={send}><textarea className="min-h-12 max-h-[125px] w-full resize-y border-0 bg-transparent py-1.5 text-[13px] leading-[1.6] text-ink outline-none placeholder:text-[#9aa7a0]" value={input} onChange={(event) => setInput(event.target.value)} placeholder="写下这次做了什么" disabled={sending} /><button className="grid size-8 flex-none place-items-center rounded-md border-0 bg-signal text-on-signal" type="submit" aria-label="发送" disabled={!input.trim() || sending}><ArrowUp size={18} /></button></form></div><div className="flex min-w-0 flex-col"><MarkdownDocument markdown={document} label="事实" empty="在左侧描述行动，整理后的记录会显示在这里。" /><div className="border-t border-line px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1"><span className="text-xs font-semibold">表达</span><HelpPopover title="表达的更新"><p>默认沿用承接节点的有效表达。选择更新可采用并编辑本次对话留下的观察；选择清空会让本节点及未更新表达的后续节点保持为空。合入来源不会自动覆盖表达。</p></HelpPopover></div>
        <select className="h-8 rounded border border-line bg-paper px-2 text-xs" aria-label="表达处理方式" value={expressionMode} onChange={(event) => setExpressionMode(event.target.value as typeof expressionMode)}>
          <option value="inherit">沿用上个节点</option><option value="update">更新表达</option><option value="clear">清空表达</option>
        </select>
      </div>
      {expressionMode === 'update' ? <textarea className="mt-3 min-h-32 w-full resize-y rounded border border-line bg-paper px-3 py-2 text-[13px] leading-[1.7] outline-none focus:border-signal" aria-label="本节点的表达" placeholder="写下或调整本次行动形成的表达" value={expressionText} onChange={(event) => setExpressionDraft(event.target.value)} />
        : expressionMode === 'clear' ? <p className="mt-3 text-[11px] text-muted">本节点表达为空</p>
          : inheritedExpression ? <details className="mt-3 text-[11px] text-muted"><summary className="cursor-pointer">查看沿用的表达</summary><div className="mt-3"><MarkdownContent markdown={inheritedExpression} /></div></details> : <p className="mt-3 text-[11px] text-muted">暂无表达</p>}
    </div><div className="flex items-center justify-between gap-3.5 border-t border-line px-5 py-[13px] max-[700px]:flex-col max-[700px]:items-stretch"><span className="text-[11px] text-muted">{document ? '内容由 AI 根据本次对话整理' : '等待行动描述'}</span><button className="primary-button max-[700px]:w-full" type="button" onClick={() => onConfirm(document, details, messages.filter((message) => !message.id.startsWith('error-')), expressionMarkdown)} disabled={!document || sending || (expressionMode === 'update' && !expressionText.trim())}><Check size={15} />发布行动节点</button></div></div></div></section>
}
