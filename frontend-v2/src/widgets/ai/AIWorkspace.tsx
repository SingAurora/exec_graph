import { ArrowLeft, ArrowUp, Check, LoaderCircle, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import { generateAIDocument, type AIConversationTurn } from '../../features/ai-key/api/chat'
import type { ChatMessage, PlanNode } from '../../shared/model'
import { Avatar } from '../layout/AppShell'
import { MarkdownDocument } from './MarkdownDocument'

type AIWorkspaceProps = {
  mode: 'planning' | 'completion'
  profileName: string
  aiConfig?: AIKeyConfig
  plan?: PlanNode
  topicTitle?: string
  initialDocument?: string
  onBack: () => void
  onStartCompletion?: () => void
  onConfirm: (markdown: string, details: { title: string; description: string; points: string[]; note: string }) => void
}

export function AIWorkspace({ mode, profileName, aiConfig, plan, topicTitle, initialDocument = '', onBack, onStartCompletion, onConfirm }: AIWorkspaceProps) {
  const isCompletion = mode === 'completion'
  const initialCompletionNote = isCompletion ? readMarkdownSection(initialDocument, '这次实际发生') : ''
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', speaker: 'ai', body: initialDocument ? isCompletion ? '这是我们最近整理的完成记录。你可以继续补充实际发生的内容。' : '这是我们最近确认的执行计划。你可以继续补充，或者按计划推进。' : isCompletion ? '这次实际发生了什么？不用写得完整，告诉我你记得的部分就好。' : topicTitle ? `你准备以自己的方式完成「${topicTitle}」。先说说你想怎么做。` : '你想推进什么事情？先说说你现在最想开始的一件事。' }])
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
        plan: plan ? { title: plan.title, description: plan.description, points: plan.points } : undefined,
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
    onConfirm(document, draft)
  }

  return <section className="ai-workspace" aria-label={isCompletion ? '生成完成记录' : '生成执行计划'}>
    <header className="workspace-header"><button className="icon-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={17} /></button><div><span className="section-kicker">{isCompletion ? '完成节点' : '计划节点'}</span><h2>{isCompletion ? '生成完成记录' : '生成执行计划'}</h2></div><span className="workspace-mode" title={aiConfig ? `${aiConfig.label} · ${aiConfig.model}` : 'AI 整理'}><Sparkles size={14} /><span>{aiConfig?.model ?? 'AI 整理'}</span></span></header>
    <div className="workspace-tabs" role="tablist" aria-label="工作区面板"><button className={mobilePanel === 'chat' ? 'is-active' : ''} type="button" onClick={() => setMobilePanel('chat')} role="tab">对话</button><button className={mobilePanel === 'document' ? 'is-active' : ''} type="button" onClick={() => setMobilePanel('document')} role="tab">文档</button></div>
    <div className="workspace-grid">
      <div className={`chat-panel ${mobilePanel === 'chat' ? 'mobile-visible' : ''}`}>
        <div className="chat-intro"><span className="ai-avatar"><Sparkles size={15} /></span><div><strong>ExecG AI</strong><p>{isCompletion ? '帮你把实际发生的事情整理清楚。' : '帮你把想做的事情整理成执行计划。'}</p></div></div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message) => <div className={`chat-message ${message.speaker}`} key={message.id}>{message.speaker === 'ai' && <span className="message-avatar"><Sparkles size={13} /></span>}<div className="message-bubble">{message.body}</div>{message.speaker === 'user' && <Avatar label={profileName.slice(0, 1)} size="small" />}</div>)}
          {sending && <div className="chat-message ai"><span className="message-avatar"><Sparkles size={13} /></span><div className="message-bubble is-thinking"><LoaderCircle size={14} className="spin" />正在整理</div></div>}
        </div>
        <form className="chat-input" onSubmit={sendMessage}><label className="sr-only" htmlFor="chatMessage">{prompt}</label><textarea id="chatMessage" rows={2} value={input} onChange={(event) => setInput(event.target.value)} placeholder={prompt} disabled={sending} /><button className="send-button" type="submit" aria-label="发送" disabled={!input.trim() || sending}><ArrowUp size={18} /></button></form>
      </div>
      <div className={`document-wrap ${mobilePanel === 'document' ? 'mobile-visible' : ''}`}><MarkdownDocument markdown={document} label={isCompletion ? '完成记录' : '执行计划'} empty={isCompletion ? '告诉我这次实际发生了什么，完成记录会在这里生成。' : '先在左侧告诉我想推进的事情，执行计划会在这里生成。'} /><div className="document-actions"><span>{documentReady ? '内容由 AI 根据本次对话整理' : '等待对话内容'}</span><div className="document-action-buttons">{onStartCompletion && <button className="quiet-button" type="button" onClick={onStartCompletion}>记录完成</button>}<button className="primary-button" type="button" onClick={confirm} disabled={!documentReady}>{documentReady ? <><Check size={15} />{isCompletion ? '确认完成记录' : plan ? '确认计划更新' : '确认执行计划'}</> : '等待生成'}</button></div></div></div>
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
