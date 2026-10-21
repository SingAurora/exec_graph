import { ArrowLeft, ArrowUp, ChevronDown, Footprints, LoaderCircle, MessageCircle, ScrollText, Sparkles } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type UIEvent } from 'react'
import type { ActionExpressionContext, ActionExpressionMessage } from '../../entities/action/model/types'
import type { PostImage, UserProfile } from '../../shared/model'
import { Avatar } from '../../shared/ui/Avatar'
import { ProfilePreview } from '../../entities/profile/ui/ProfilePreview'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import type { WorkspaceView } from './model/workspace-draft'

type WorkspaceTab = 'conversation' | 'objective' | 'expression' | 'agreement'
type DocumentPreview = { markdown: string; images?: PostImage[]; status?: string; empty: string }
type WorkspaceFrameProps = {
  title: string
  tabLabel: string
  help: ReactNode
  draftControls?: ReactNode
  view?: WorkspaceView
  onViewChange?: (view: WorkspaceView) => void
  restoring?: boolean
  context?: { label: string; title?: string; facts: ActionExpressionContext['facts'] }
  contextControls?: ReactNode
  messages: ActionExpressionMessage[]
  profileName: string
  profile?: UserProfile
  users?: UserProfile[]
  defaultAuthorId?: string
  input: string
  inputLabel?: string
  placeholder: string
  sending: boolean
  disabled?: boolean
  onInputChange: (value: string) => void
  onSend: (event: FormEvent) => void
  onBack: () => void
  action: DocumentPreview
  expression: DocumentPreview
  agreement: ReactNode
  footer: ReactNode
}

/** Shared full-width conversation and document tabs for creating actions and revising expressions. */
export function WorkspaceFrame({ title, tabLabel, help, draftControls, view, onViewChange, restoring = false, context, contextControls, messages, profileName, profile, users = [], defaultAuthorId, input, inputLabel = '对话内容', placeholder, sending, disabled = false, onInputChange, onSend, onBack, action, expression, agreement, footer }: WorkspaceFrameProps) {
  const [localTab, setTab] = useState<WorkspaceTab>('conversation')
  const tab = view?.tab ?? localTab
  const panels = useRef<Partial<Record<WorkspaceTab, HTMLDivElement | null>>>({})
  const positions = useRef<Partial<Record<WorkspaceTab, number>>>({})
  const pendingConversationScroll = useRef(true)
  const lastMessageId = messages.at(-1)?.id
  const previousMessageId = useRef(lastMessageId)
  const initialized = useRef(false)

  const changeTab = (value: string) => {
    const current = panels.current[tab]
    if (current) positions.current[tab] = current.scrollTop
    if (onViewChange) onViewChange({ tab: value as WorkspaceTab, positions: { ...view?.positions, ...positions.current } })
    setTab(value as WorkspaceTab)
  }
  useLayoutEffect(() => {
    if (restoring) return
    const element = panels.current[tab]
    if (element) element.scrollTop = view ? view.positions[tab] ?? 0 : positions.current[tab] ?? 0
  }, [tab, view, restoring])
  useLayoutEffect(() => {
    if (restoring) return
    if (!initialized.current) {
      pendingConversationScroll.current = view?.positions.conversation === undefined
      initialized.current = true
    } else if (lastMessageId !== previousMessageId.current || sending) pendingConversationScroll.current = true
    previousMessageId.current = lastMessageId
  }, [lastMessageId, sending, restoring, view])
  useLayoutEffect(() => {
    const element = panels.current.conversation
    if (restoring || tab !== 'conversation' || !element || !pendingConversationScroll.current) return
    element.scrollTop = element.scrollHeight
    pendingConversationScroll.current = false
  }, [lastMessageId, sending, tab, restoring])
  const rememberScroll = (value: WorkspaceTab, event: UIEvent<HTMLDivElement>) => {
    if (restoring || value !== tab || !event.currentTarget.clientHeight) return
    const top = event.currentTarget.scrollTop
    positions.current[value] = top
    if (view && onViewChange && view.positions[value] !== top) onViewChange({ ...view, positions: { ...view.positions, [value]: top } })
  }

  return <section className="flex h-[calc(100dvh-116px)] min-h-[500px] flex-col pt-[22px]" aria-label={title}>
    <header className="flex min-h-9 shrink-0 items-center gap-3">
      <button className="icon-button" type="button" onClick={onBack} aria-label="返回行动图"><ArrowLeft size={17} /></button>
      <h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2>
      <div className="ml-auto flex items-center gap-3">{draftControls}{help}</div>
    </header>
    {context && <div className="mt-3 shrink-0 rounded-md bg-soft px-3 py-2 text-xs leading-5" aria-label="本次引用背景"><div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 text-muted">{context.label}</span>
      <span className="min-w-0 flex-1 truncate" title={context.title}>{context.title}</span>
      <details className="group/history relative shrink-0">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-muted hover:text-signal [&::-webkit-details-marker]:hidden">历史 {context.facts.length} 个节点<ChevronDown size={13} className="transition-transform group-open/history:rotate-180" /></summary>
        <div className="absolute right-0 top-full z-30 mt-2 max-h-64 w-80 overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-lg">
          {context.facts.length ? context.facts.map((fact) => <p className="py-1.5 text-xs leading-5" key={fact.number}><span className="mr-2 tabular-nums text-muted">#{fact.number}</span>{fact.title}</p>) : <p className="text-muted">无历史节点</p>}
        </div>
      </details>
    </div>{contextControls && <div className="mt-2">{contextControls}</div>}</div>}
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <TabsRoot value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5">
          <TabsList label={tabLabel} showDivider={false}>
            <TabsTrigger value="conversation"><span className="inline-flex items-center gap-1.5"><Sparkles size={16} />AI 对话</span></TabsTrigger>
            <TabsTrigger value="objective"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
            <TabsTrigger value="expression"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
            <TabsTrigger value="agreement"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="conversation" keepMounted className="flex min-h-0 flex-1 flex-col">
          <div ref={(element) => { panels.current.conversation = element }} onScroll={(event) => rememberScroll('conversation', event)} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-6" aria-label="连续 AI 对话" aria-live="polite">
            {messages.map((message) => {
              const authorId = message.authorId ?? defaultAuthorId ?? profile?.id
              const author = users.find((user) => user.id === authorId) ?? (authorId === profile?.id ? profile : undefined)
              const authorName = author?.name ?? authorId ?? profileName
              return <div className={'flex max-w-[90%] items-end gap-2 ' + (message.speaker === 'user' ? 'ml-auto flex-row-reverse' : '')} key={message.id}>
                {message.speaker === 'ai' ? <span className="grid size-[25px] shrink-0 place-items-center rounded-full bg-signal-soft text-signal"><Sparkles size={13} /></span> : authorId ? <ProfilePreview profile={author} userId={authorId} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={author} label={authorName} size="small" /></ProfilePreview> : <Avatar label={authorName} size="small" />}
                <div className={'min-w-0 rounded-lg px-3 py-2.5 text-[13px] leading-[1.7] ' + (message.id.startsWith('error-') ? 'border border-coral/30 bg-paper text-coral' : message.speaker === 'user' ? 'bg-soft' : 'border border-line bg-paper')} role={message.id.startsWith('error-') ? 'alert' : undefined}><MarkdownContent markdown={message.body} /></div>
              </div>
            })}
            {sending && <div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" />正在整理</div>}
          </div>
          <form className="mx-6 mb-5 flex shrink-0 items-end gap-2 rounded-lg border border-line bg-paper px-3 py-2" onSubmit={onSend}>
            <textarea className="min-h-12 max-h-32 w-full resize-y border-0 bg-transparent py-1.5 text-sm leading-[1.6] outline-none" aria-label={inputLabel} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder={placeholder} disabled={sending || disabled} />
            <button className="icon-button border-signal bg-signal text-on-signal" type="submit" aria-label="发送" disabled={!input.trim() || sending || disabled}><ArrowUp size={18} /></button>
          </form>
        </TabsContent>
        {(['objective', 'expression'] as const).map((value) => {
          const preview = value === 'objective' ? action : expression
          return <TabsContent value={value} keepMounted className="min-h-0 flex-1" key={value}>
            <div ref={(element) => { panels.current[value] = element }} onScroll={(event) => rememberScroll(value, event)} className="h-full overflow-y-auto overscroll-contain px-6 py-5" aria-label={value === 'objective' ? '行动文档预览' : '表达文档预览'}>
              {preview.status && <p className="mb-4 text-xs leading-5 text-muted">{preview.status}</p>}
              {preview.markdown.trim() ? <MarkdownContent markdown={preview.markdown} images={preview.images} /> : <p className="py-5 text-sm leading-7 text-muted">{preview.empty}</p>}
            </div>
          </TabsContent>
        })}
        <TabsContent value="agreement" keepMounted className="min-h-0 flex-1">
          <div ref={(element) => { panels.current.agreement = element }} onScroll={(event) => rememberScroll('agreement', event)} className="h-full overflow-y-auto overscroll-contain py-5">{agreement}</div>
        </TabsContent>
      </TabsRoot>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3">{footer}</div>
    </div>
  </section>
}
