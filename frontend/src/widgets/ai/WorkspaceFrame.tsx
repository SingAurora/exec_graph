import { ArrowLeft, BookOpen, ChevronDown, Footprints, LoaderCircle, MessageCircle, ScrollText, SendHorizontal, Sparkles } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type UIEvent } from 'react'
import type { ActionExpressionContext, ActionExpressionMessage } from '../../entities/action/model/types'
import { ACTION_CONTENT_LIMIT, ACTION_TITLE_LIMIT } from '../../entities/action/model/limits'
import type { PostImage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'
import { RecordThumbnails } from '../../shared/ui/RecordThumbnails'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { CopyConversationButton } from '../../shared/ui/CopyConversationButton'
import { Dialog } from '../../shared/ui/dialog/Dialog'
import { formatConversationForCopy } from '../../shared/lib/format-conversation'
import type { WorkspaceView } from './model/workspace-draft'
import { CHAT_INPUT_LIMIT, resizeChatInput, shouldSendChatOnEnter } from './model/chat-input'

type WorkspaceTab = 'conversation' | 'objective' | 'expression' | 'agreement' | 'guide'
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
  tabActions?: ReactNode
  composerMode?: 'conversation' | 'image'
  onComposerModeChange?: (mode: 'conversation' | 'image') => void
  imageComposer?: ReactNode
  imageModeBadge?: string | number
  status?: { text: string; tone: 'muted' | 'signal' | 'warning' | 'coral' }
  messages: ActionExpressionMessage[]
  starterHint?: ReactNode
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
  guide?: ReactNode
  footer?: ReactNode
}

/** 三类工作区共用界面框架；各工作区只显示当前业务需要的文档栏目。 */
export function WorkspaceFrame({ title, tabs = ['conversation', 'objective', 'expression', 'agreement'], help, draftControls, view, onViewChange, restoring = false, context, tabActions, composerMode = 'conversation', onComposerModeChange, imageComposer, imageModeBadge, status, messages, starterHint, profileName, profile, users = [], defaultAuthorId, input, inputLabel = '对话内容', placeholder, sending, sendingLabel = '正在整理', fallbackAIName, disabled = false, onInputChange, onSend, onBack, action, actionControls, expression, agreement, guide, footer }: WorkspaceFrameProps) {
  const [localTab, setTab] = useState<WorkspaceTab>('conversation')
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false)
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
  const statusDot = status?.tone === 'coral' ? 'bg-coral' : status?.tone === 'warning' ? 'bg-warning' : status?.tone === 'signal' ? 'bg-signal' : 'bg-muted'
  const copiedModel = fallbackAIName?.trim() || [...messages].reverse().find((message) => message.speaker === 'ai' && message.model?.trim())?.model?.trim()
  const copyText = formatConversationForCopy(messages.filter((message) => message.id !== 'welcome'), {
    resolveUserName: (message) => {
      const authorId = message.authorId ?? defaultAuthorId ?? profile?.id
      const author = users.find((user) => user.id === authorId) ?? (authorId === profile?.id ? profile : undefined)
      return author?.name ?? authorId ?? profileName
    },
    fallbackAIName: copiedModel || '引序 AI',
  })

  return (
    <section className="relative flex h-[calc(100dvh-116px)] min-h-[500px] flex-col">
      <header className="relative flex min-h-9 shrink-0 items-center gap-3">
        <div className="absolute -left-[38px] top-0 z-10"><button className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted transition-colors hover:bg-soft hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" title="返回行动图" onClick={onBack}><ArrowLeft size={18} strokeWidth={1.8} /></button></div>
        <h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2">{draftControls}{help}</div>
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <TabsRoot value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-5">
            <TabsList showDivider={false} flush>
              {tabs.map((value) => <TabsTrigger key={value} value={value}><span className="inline-flex items-center gap-1.5">
                {value === 'conversation' ? <><Sparkles size={16} />AI 对话</>
                  : value === 'objective' ? <><Footprints size={16} />行动</>
                    : value === 'expression' ? <><MessageCircle size={16} />表达</>
                      : value === 'agreement' ? <><ScrollText size={16} />约定</>
                        : <><BookOpen size={16} />默认效果</>}
              </span></TabsTrigger>)}
            </TabsList>
            <div className="flex min-w-0 items-center justify-end gap-2">
              {tabActions}
              <button className="text-button min-w-0 max-w-[22vw] gap-1 text-[11px] leading-4" type="button" onClick={() => setNodeInfoOpen(true)} title="查看节点信息和操作">
                <span className="truncate">{context?.label ?? '节点信息'}</span><ChevronDown size={12} className="shrink-0" />
              </button>
              {status && <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4" title={status.text}><span className={`size-1.5 shrink-0 rounded-full ${statusDot}`} /><span className="max-w-[28vw] truncate max-[700px]:max-w-[32vw]">{status.text}</span></span>}
            </div>
          </div>
          <TabsContent value="conversation" keepMounted className="flex min-h-0 flex-1 flex-col bg-paper">
            <div ref={(element) => { panels.current.conversation = element }} onScroll={(event) => rememberScroll('conversation', event)} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-6">
              {messages.length === 0 && starterHint && <div className="max-w-[85%] py-2 text-sm leading-7 text-muted">{starterHint}</div>}
              {messages.map((message) => (
                <div className={'w-fit max-w-[78%] max-[700px]:max-w-[88%] ' + (message.speaker === 'user' ? 'ml-auto' : '')} key={message.id}>
                  <div className={'min-w-0 rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,.025)] ' + (message.id.startsWith('error-') ? 'border border-coral/30 bg-surface' : message.speaker === 'user' ? 'bg-soft' : 'border border-line bg-surface')}>
                    <MarkdownContent markdown={message.body} className={`chat-markdown${message.id.startsWith('error-') ? ' chat-markdown-error' : ''}`} />
                    {message.images?.length ? <RecordThumbnails images={message.images} size="small" /> : null}
                  </div>
                </div>
              ))}
              {sending && <div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" />{sendingLabel}</div>}
            </div>
            <div className="shrink-0 border-t border-line bg-surface px-6 pb-5 pt-3">
              {imageComposer && <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex rounded-md border border-line bg-paper p-0.5">
                  <button className="rounded px-3 py-1.5 text-xs font-medium text-muted data-[active=true]:bg-soft data-[active=true]:text-signal" type="button" data-active={composerMode === 'conversation'} onClick={() => onComposerModeChange?.('conversation')}>文字</button>
                  <button className="rounded px-3 py-1.5 text-xs font-medium text-muted data-[active=true]:bg-soft data-[active=true]:text-signal" type="button" data-active={composerMode === 'image'} onClick={() => onComposerModeChange?.('image')}>图片{imageModeBadge !== undefined && imageModeBadge !== 0 ? ` ${imageModeBadge}` : ''}</button>
                </div>
              </div>}
              {imageComposer && composerMode === 'image' ? <div>{imageComposer}<div className="mt-2"><CopyConversationButton text={copyText} label="复制对话" className="text-button text-xs" /></div></div> : <form className="flex flex-col gap-2" onSubmit={onSend}>
                <div className="rounded-lg border border-line bg-paper px-3 py-2 transition-colors focus-within:border-signal">
                  <textarea ref={inputRef} className="workspace-chat-input min-h-12 max-h-32 w-full resize-none overflow-y-auto border-0 bg-transparent py-1.5 text-sm leading-[1.6] outline-none" title={inputLabel} maxLength={CHAT_INPUT_LIMIT} value={input} onChange={(event) => onInputChange(event.target.value)} onKeyDown={(event) => {
                    if (!shouldSendChatOnEnter(event.key, event.shiftKey, event.nativeEvent.isComposing)) return
                    event.preventDefault()
                    if (!input.trim() || sending || disabled) return
                    event.currentTarget.form?.requestSubmit()
                  }} placeholder={placeholder} disabled={sending || disabled} />
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <CopyConversationButton text={copyText} label="复制对话" className="text-button text-xs" />
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-[11px] leading-4 tabular-nums ${input.length >= CHAT_INPUT_LIMIT ? 'text-coral' : 'text-muted'}`} title={`最多 ${CHAT_INPUT_LIMIT} 字`}>{input.length}/{CHAT_INPUT_LIMIT}</span>
                    <button className="inline-grid size-8 shrink-0 place-items-center rounded-md border-0 bg-transparent text-signal transition hover:bg-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent" type="submit" title="发送" disabled={!input.trim() || input.length > CHAT_INPUT_LIMIT || sending || disabled}><SendHorizontal size={17} /></button>
                  </div>
                </div>
              </form>}
            </div>
          </TabsContent>
          {(['objective', 'expression'] as const).filter((value) => tabs.includes(value)).map((value) => {
            const preview = value === 'objective' ? action : expression
            const title = visiblePreviewTitle(preview)
            const titleCount = value === 'objective' ? characterCount(preview.title ?? '') : 0
            const contentCount = value === 'objective' ? characterCount(preview.markdown) : 0
            return (
              <TabsContent value={value} keepMounted className="min-h-0 flex-1" key={value}>
                <div ref={(element) => { panels.current[value] = element }} onScroll={(event) => rememberScroll(value, event)} className="h-full overflow-y-auto overscroll-contain bg-paper px-6 py-5">
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
            <div ref={(element) => { panels.current.agreement = element }} onScroll={(event) => rememberScroll('agreement', event)} className="h-full overflow-y-auto overscroll-contain bg-paper py-5">{agreement}</div>
          </TabsContent>}
          {tabs.includes('guide') && <TabsContent value="guide" keepMounted className="min-h-0 flex-1">
            <div ref={(element) => { panels.current.guide = element }} onScroll={(event) => rememberScroll('guide', event)} className="h-full overflow-y-auto overscroll-contain bg-paper px-6 py-6">{guide}</div>
          </TabsContent>}
        </TabsRoot>
        {footer && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-6 py-3">{footer}</div>}
      </div>
      <Dialog open={nodeInfoOpen} onOpenChange={setNodeInfoOpen} title="节点信息" description="当前节点的详细信息和可执行操作">
        <div className="mt-4 grid gap-4 text-sm">
          <div><p className="text-xs text-muted">{context?.label ?? '当前行动'}</p><p className="mt-1 font-medium leading-6">{context?.title ?? '尚未发布节点'}</p></div>
          <div><p className="mb-2 text-xs font-medium text-muted">历史节点</p>{context?.facts.length ? context.facts.map((fact) => <p className="py-1 text-xs leading-5" key={fact.number}><span className="mr-2 tabular-nums text-muted">#{fact.number}</span>{fact.title}</p>) : <p className="text-xs text-muted">暂无历史节点</p>}</div>
          <div className="mt-2 flex justify-end gap-3">
            <button className="quiet-button" type="button" onClick={() => { setNodeInfoOpen(false); onBack() }}>返回行动图</button>
            <button className="primary-button" type="button" onClick={() => setNodeInfoOpen(false)}>关闭</button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
