import { ArrowLeft, ArrowUp, ChevronDown, Footprints, LoaderCircle, MessageCircle, ScrollText, Sparkles } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type UIEvent } from 'react'
import type { ActionExpressionContext, ActionExpressionMessage } from '../../entities/action/model/types'
import { ACTION_CONTENT_LIMIT, ACTION_TITLE_LIMIT } from '../../entities/action/model/limits'
import type { PostImage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { CopyConversationButton } from '../../shared/ui/CopyConversationButton'
import { formatConversationForCopy } from '../../shared/lib/format-conversation'
import type { WorkspaceView } from './model/workspace-draft'
import { CHAT_INPUT_LIMIT, resizeChatInput } from './model/chat-input'

type WorkspaceTab = 'conversation' | 'objective' | 'expression' | 'agreement'
type DocumentPreview = { title?: string; markdown: string; images?: PostImage[]; status?: string; empty: string }

/** 正文已经用同名标题开头时，不再重复显示文档标题。 */
function visiblePreviewTitle(preview: DocumentPreview): string | undefined {
  const title = preview.title?.trim()
  if (!title) return undefined
  const firstLine = preview.markdown.trimStart().split('\n', 1)[0]?.replace(/^#{1,6}\s+/, '').trim()
  return firstLine === title ? undefined : title
}

/** 按 Unicode 码点计数，与服务端 utf8.RuneCountInString 的口径一致。 */
function characterCount(value: string): number {
  return [...value].length
}


type WorkspaceFrameProps = {
  title: string
  tabs?: WorkspaceTab[]
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
  sendingLabel?: string
  fallbackAIName?: string
  disabled?: boolean
  onInputChange: (value: string) => void
  onSend: (event: FormEvent) => void
  onBack: () => void
  action: DocumentPreview
  actionControls?: ReactNode
  expression: DocumentPreview
  agreement: ReactNode
  footer: ReactNode
}

/** 三类工作区共用界面框架；各工作区只显示当前业务需要的文档栏目。 */
export function WorkspaceFrame({ title, tabs = ['conversation', 'objective', 'expression', 'agreement'], help, draftControls, view, onViewChange, restoring = false, context, contextControls, messages, profileName, profile, users = [], defaultAuthorId, input, inputLabel = '对话内容', placeholder, sending, sendingLabel = '正在整理', fallbackAIName, disabled = false, onInputChange, onSend, onBack, action, actionControls, expression, agreement, footer }: WorkspaceFrameProps) {
  const [localTab, setTab] = useState<WorkspaceTab>('conversation')
  const requestedTab = view?.tab ?? localTab
  const tab = tabs.includes(requestedTab) ? requestedTab : tabs[0] ?? 'conversation'
  const panels = useRef<Partial<Record<WorkspaceTab, HTMLDivElement | null>>>({})
  const positions = useRef<Partial<Record<WorkspaceTab, number>>>({})
  const pendingConversationScroll = useRef(true)
  const lastMessageId = messages.at(-1)?.id
  const previousMessageId = useRef(lastMessageId)
  const initialized = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    resizeChatInput(inputRef.current)
  }, [input, tab])

  const changeTab = (value: string) => {
    const current = panels.current[tab]
    if (current) positions.current[tab] = current.scrollTop
    if (onViewChange) onViewChange({ tab: value as WorkspaceTab, positions: { ...view?.positions, ...positions.current } })
    setTab(value as WorkspaceTab)
  }
  // useLayoutEffect 在浏览器绘制前恢复滚动，减少切 Tab 后先显示顶部再跳回原位置的闪动。
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
  const copyText = formatConversationForCopy(messages.filter((message) => message.id !== 'welcome'), {
    resolveUserName: (message) => {
      const authorId = message.authorId ?? defaultAuthorId ?? profile?.id
      const author = users.find((user) => user.id === authorId) ?? (authorId === profile?.id ? profile : undefined)
      return author?.name ?? authorId ?? profileName
    },
    fallbackAIName: fallbackAIName ?? '引序 AI',
  })

  return (
    <section className="flex h-[calc(100dvh-116px)] min-h-[500px] flex-col pt-[22px]">
      <header className="flex min-h-9 shrink-0 items-center gap-3">
        <button className="icon-button" type="button" onClick={onBack} title="返回行动图"><ArrowLeft size={17} /></button>
        <h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2>
        <div className="ml-auto flex items-center gap-3">{draftControls}{help}</div>
      </header>
      {context && <div className="mt-3 shrink-0 rounded-md bg-soft px-3 py-2 text-xs leading-5"><div className="flex min-w-0 items-center gap-3">
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
            <TabsList showDivider={false}>
              {tabs.map((value) => <TabsTrigger key={value} value={value}><span className="inline-flex items-center gap-1.5">
                {value === 'conversation' ? <><Sparkles size={16} />AI 对话</>
                  : value === 'objective' ? <><Footprints size={16} />行动</>
                    : value === 'expression' ? <><MessageCircle size={16} />表达</>
                      : <><ScrollText size={16} />约定</>}
              </span></TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value="conversation" keepMounted className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 justify-end px-6 pt-3">
              <CopyConversationButton text={copyText} />
            </div>
            <div ref={(element) => { panels.current.conversation = element }} onScroll={(event) => rememberScroll('conversation', event)} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-6">
              {messages.map((message) => (
                <div className={'w-fit max-w-full ' + (message.speaker === 'user' ? 'ml-auto' : '')} key={message.id}>
                  <div className={'min-w-0 rounded-lg px-3 py-2.5 text-[13px] leading-[1.7] ' + (message.id.startsWith('error-') ? 'border border-coral/30 bg-paper text-coral' : message.speaker === 'user' ? 'bg-soft' : 'border border-line bg-paper')}><MarkdownContent markdown={message.body} /></div>
                </div>
              ))}
              {sending && <div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" />{sendingLabel}</div>}
            </div>
            <form className="mx-6 mb-5 flex shrink-0 items-end gap-2 rounded-lg border border-line bg-paper px-3 py-2" onSubmit={onSend}>
              <textarea ref={inputRef} className="workspace-chat-input min-h-12 max-h-32 w-full resize-none overflow-y-auto border-0 bg-transparent py-1.5 text-sm leading-[1.6] outline-none" title={inputLabel} maxLength={CHAT_INPUT_LIMIT} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder={placeholder} disabled={sending || disabled} />
              <span className={`shrink-0 self-end pb-2 text-[11px] leading-4 tabular-nums ${input.length >= CHAT_INPUT_LIMIT ? 'text-coral' : 'text-muted'}`} title={`最多 ${CHAT_INPUT_LIMIT} 字`}>{input.length}/{CHAT_INPUT_LIMIT}</span>
              <button className="icon-button border-signal bg-signal text-on-signal" type="submit" title="发送" disabled={!input.trim() || input.length > CHAT_INPUT_LIMIT || sending || disabled}><ArrowUp size={18} /></button>
            </form>
          </TabsContent>
          {(['objective', 'expression'] as const).filter((value) => tabs.includes(value)).map((value) => {
            const preview = value === 'objective' ? action : expression
            const title = visiblePreviewTitle(preview)
            const titleCount = value === 'objective' ? characterCount(preview.title ?? '') : 0
            const contentCount = value === 'objective' ? characterCount(preview.markdown) : 0
            return (
              <TabsContent value={value} keepMounted className="min-h-0 flex-1" key={value}>
                <div ref={(element) => { panels.current[value] = element }} onScroll={(event) => rememberScroll(value, event)} className="h-full overflow-y-auto overscroll-contain px-6 py-5">
                  {title && <h2 className={`${value === 'objective' ? 'mb-2' : 'mb-4'} break-words text-xl font-semibold leading-[1.5] tracking-[-.02em] text-ink`}>{title}</h2>}
                  {value === 'objective' && <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-4 tabular-nums text-muted">
                    <span className={titleCount > ACTION_TITLE_LIMIT ? 'text-coral' : undefined}>标题 {titleCount}/{ACTION_TITLE_LIMIT}</span>
                    <span className={contentCount > ACTION_CONTENT_LIMIT ? 'text-coral' : undefined}>正文 {contentCount}/{ACTION_CONTENT_LIMIT}</span>
                  </p>}
                  {value === 'objective' && actionControls}
                  {preview.status && <p className="mb-4 text-xs leading-5 text-muted">{preview.status}</p>}
                  {preview.markdown.trim() ? <MarkdownContent markdown={preview.markdown} images={preview.images} /> : <p className="py-5 text-sm leading-7 text-muted">{preview.empty}</p>}
                </div>
              </TabsContent>
            )
          })}
          {tabs.includes('agreement') && <TabsContent value="agreement" keepMounted className="min-h-0 flex-1">
            <div ref={(element) => { panels.current.agreement = element }} onScroll={(event) => rememberScroll('agreement', event)} className="h-full overflow-y-auto overscroll-contain py-5">{agreement}</div>
          </TabsContent>}
        </TabsRoot>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3">{footer}</div>
      </div>
    </section>
  )
}
