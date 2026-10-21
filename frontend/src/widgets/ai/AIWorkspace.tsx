import { ArrowLeft, ArrowUp, Check, LoaderCircle, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import { generateAIDocument, type AIConversationTurn } from '../../features/ai-key/api/chat'
import type { ChatMessage } from '../../shared/model/content'
import type { PlanNode } from '../../entities/action/model/legacy-types'
import { Avatar } from '../../shared/ui/Avatar'
import { MarkdownDocument } from './MarkdownDocument'

type AIWorkspaceProps = {
  mode: 'planning' | 'completion'
  profileName: string
  aiConfig?: AIKeyConfig
  plan?: PlanNode
  contextPlan?: PlanNode
  topicTitle?: string
  initialDocument?: string
  initialMessages?: ChatMessage[]
  continuationFromPlan?: boolean
  onBack: () => void
  onStartCompletion?: () => void
  onConfirm: (markdown: string, details: { title: string; description: string; points: string[]; note: string }, messages: ChatMessage[]) => void
}

export function AIWorkspace({ mode, profileName, aiConfig, plan, contextPlan, topicTitle, initialDocument = '', initialMessages, continuationFromPlan = false, onBack, onStartCompletion, onConfirm }: AIWorkspaceProps) {
  const isCompletion = mode === 'completion'
  const initialCompletionNote = isCompletion ? readMarkdownSection(initialDocument, '这次实际发生') : ''
  const welcomeMessage: ChatMessage = { id: 'welcome', speaker: 'ai', body: initialDocument ? continuationFromPlan ? '这是上一阶段的计划文档。接下来我们沿着它记录实际发生的事情，并在这份文档上继续整理。' : isCompletion ? '这是我们最近整理的完成记录。你可以继续补充实际发生的内容。' : '这是我们最近确认的执行计划。你可以继续补充，或者按计划推进。' : isCompletion ? '这次实际发生了什么？不用写得完整，告诉我你记得的部分就好。' : contextPlan ? `你正在从「${contextPlan.title}」继续。可以沿着这条路径推进，也可以提出一个不同的方案。先说说你想怎么做。` : topicTitle ? `你准备以自己的方式完成「${topicTitle}」。先说说你想怎么做。` : '你想推进什么事情？先说说你现在最想开始的一件事。' }
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages?.length ? initialMessages : [welcomeMessage])
  const [input, setInput] = useState('')
  const [document, setDocument] = useState(initialDocument)
  const [documentReady, setDocumentReady] = useState(Boolean(initialDocument))
  const [sending, setSending] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'document'>('chat')
  const [draft, setDraft] = useState<{ title: string; description: string; points: string[]; note: string }>({ title: plan?.title ?? '', description: plan?.description ?? '', points: plan?.points ?? [], note: initialCompletionNote })

  const prompt = useMemo(() => isCompletion ? '描述这次实际发生的事情' : '描述你想推进的事情', [isCompletion])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!clean || sending) return
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, speaker: 'user', body: clean }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      if (!aiConfig) throw new Error('还没有可用的 AI 配置，请先前往设置。')
      const turns: AIConversationTurn[] = nextMessages
        .filter((message) => message.id !== 'welcome' && !message.id.startsWith('error-'))
        .map((message) => ({ role: message.speaker === 'ai' ? 'assistant' : 'user', content: message.body }))
      const result = await generateAIDocument({
        config: aiConfig,
        mode,
        turns,
        currentDocument: document,
        plan: (plan ?? contextPlan) ? { title: (plan ?? contextPlan)!.title, description: (plan ?? contextPlan)!.description, points: (plan ?? contextPlan)!.points } : undefined,
        planMarkdown: (plan ?? contextPlan)?.markdown,
      })
      setDraft(result.details)
      setDocument(result.document)
      setMessages((current) => [...current, { id: `ai-${Date.now()}`, speaker: 'ai', body: result.reply }])
      setDocumentReady(true)
      setMobilePanel('document')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。'
      setMessages((current) => [...current, { id: `error-${Date.now()}`, speaker: 'ai', body: `暂时无法更新文档：${message}` }])
    } finally {
      setSending(false)
    }
  }

  const confirm = () => {
    if (!documentReady || !document) return
    onConfirm(document, draft, messages.filter((message) => !message.id.startsWith('error-')))
  }

  return <section className="pt-[22px]" aria-label={isCompletion ? '生成完成记录' : '生成执行计划'}>
    <header className="flex min-h-[46px] items-center gap-3 max-[700px]:pt-0.5"><button className="icon-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={17} /></button><div className="min-w-0"><span className="section-kicker">{isCompletion ? '完成节点' : '计划节点'}</span><h2 className="mt-[3px] text-xl tracking-[-.03em]">{isCompletion ? '生成完成记录' : '生成执行计划'}</h2></div><span className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-signal" title={aiConfig ? `${aiConfig.label} · ${aiConfig.model}` : 'AI 整理'}><Sparkles size={14} /><span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">{aiConfig?.model ?? 'AI 整理'}</span></span></header>
    <div className="hidden grid-cols-2 border-b border-line max-[700px]:mt-[18px] max-[700px]:grid" role="tablist" aria-label="工作区面板"><button className={`border-0 border-b-2 border-transparent bg-transparent p-2 text-[13px] font-bold text-muted ${mobilePanel === 'chat' ? 'border-signal text-signal' : ''}`} type="button" onClick={() => setMobilePanel('chat')} role="tab">对话</button><button className={`border-0 border-b-2 border-transparent bg-transparent p-2 text-[13px] font-bold text-muted ${mobilePanel === 'document' ? 'border-signal text-signal' : ''}`} type="button" onClick={() => setMobilePanel('document')} role="tab">文档</button></div>
    <div className="mt-[22px] grid min-h-[620px] grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] border border-line bg-surface max-[1000px]:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] max-[700px]:mt-[15px] max-[700px]:block max-[700px]:min-h-0 max-[700px]:border-0 max-[700px]:bg-transparent">
      <div className={`flex min-w-0 flex-col border-r border-line max-[700px]:hidden max-[700px]:min-h-[540px] max-[700px]:border max-[700px]:bg-surface ${mobilePanel === 'chat' ? 'max-[700px]:!flex' : ''}`}>
        <div className="flex gap-2.5 border-b border-line px-5 py-[19px]"><span className="grid size-8 flex-none place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={15} /></span><div className="min-w-0"><strong className="text-[13px]">引序 AI</strong><p className="mt-[3px] text-[11px] leading-[1.5] text-muted">{isCompletion ? '帮你把实际发生的事情整理清楚。' : '帮你把想做的事情整理成执行计划。'}</p></div></div>
        <div className="grid flex-1 content-start gap-4 overflow-auto px-5 py-[22px]" aria-live="polite">
          {messages.map((message) => <div className={`flex max-w-[90%] items-end gap-2 ${message.speaker === 'user' ? 'ml-auto flex-row-reverse' : ''}`} key={message.id}>{message.speaker === 'ai' && <span className="grid size-[25px] flex-none place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={13} /></span>}<div className={`rounded-[12px_12px_12px_3px] border border-line bg-paper px-3 py-2.5 text-[13px] leading-[1.65] text-ink ${message.speaker === 'user' ? 'rounded-[12px_12px_3px_12px] border-signal bg-signal text-white' : ''}`}>{message.body}</div>{message.speaker === 'user' && <Avatar label={profileName.slice(0, 1)} size="small" />}</div>)}
          {sending && <div className="flex max-w-[90%] items-end gap-2"><span className="grid size-[25px] flex-none place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={13} /></span><div className="inline-flex items-center gap-[7px] rounded-[12px_12px_12px_3px] border border-line bg-paper px-3 py-2.5 text-[13px] leading-[1.65] text-muted"><LoaderCircle size={14} className="animate-spin" />正在整理</div></div>}
        </div>
        <form className="mx-3.5 mb-3.5 flex items-end gap-[9px] rounded-lg border border-line bg-paper px-3 py-2" onSubmit={sendMessage}><label className="sr-only" htmlFor="chatMessage">{prompt}</label><textarea className="min-h-12 max-h-[125px] w-full resize-y border-0 bg-transparent py-1.5 text-[13px] leading-[1.6] text-ink outline-none placeholder:text-[#9aa7a0]" id="chatMessage" rows={2} value={input} onChange={(event) => setInput(event.target.value)} placeholder={prompt} disabled={sending} /><button className="grid size-8 flex-none place-items-center rounded-md border-0 bg-signal text-white" type="submit" aria-label="发送" disabled={!input.trim() || sending}><ArrowUp size={18} /></button></form>
      </div>
      <div className={`flex min-h-0 min-w-0 flex-col max-[700px]:hidden max-[700px]:min-h-[540px] max-[700px]:border max-[700px]:bg-surface ${mobilePanel === 'document' ? 'max-[700px]:!flex' : ''}`}><MarkdownDocument markdown={document} label={isCompletion ? '完成记录' : '执行计划'} empty={isCompletion ? '告诉我这次实际发生了什么，完成记录会在这里生成。' : '先在左侧告诉我想推进的事情，执行计划会在这里生成。'} /><div className="flex items-center justify-between gap-3.5 border-t border-line px-5 py-[13px] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:p-3"><span className="text-[11px] text-muted">{documentReady ? '内容由 AI 根据本次对话整理' : '等待对话内容'}</span><div className="flex items-center gap-2 max-[700px]:grid max-[700px]:w-full max-[700px]:grid-cols-1">{onStartCompletion && <button className="quiet-button max-[700px]:w-full" type="button" onClick={onStartCompletion}>记录完成</button>}<button className="primary-button max-[700px]:w-full" type="button" onClick={confirm} disabled={!documentReady}>{documentReady ? <><Check size={15} />{isCompletion ? '确认完成记录' : plan ? '确认计划更新' : '确认执行计划'}</> : '等待生成'}</button></div></div></div>
    </div>
  </section>
}

function readMarkdownSection(markdown: string, heading: string) {
  const marker = `## ${heading}`
  const start = markdown.indexOf(marker)
  if (start < 0) return ''
  const contentStart = start + marker.length
  const nextHeading = markdown.indexOf('\n## ', contentStart)
  return markdown.slice(contentStart, nextHeading < 0 ? undefined : nextHeading).trim()
}
