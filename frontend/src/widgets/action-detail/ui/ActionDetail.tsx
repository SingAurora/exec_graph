import { ArrowRight, ChevronDown, Ellipsis, LoaderCircle, MessageCircle, Route, Trash2 } from 'lucide-react'
import { AlertDialog, DropdownMenu, Popover } from 'radix-ui'
import { useMemo, useState } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionParentIds } from '../../../entities/action/lib/graph'
import { getActionLevels } from '../../../entities/action/lib/levels'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { DetailPanelControls } from '../../../shared/ui/DetailPanelControls'
import { ActionSourceAgreements } from './ActionAgreements'
import type { NodeDocument } from '../../../features/action-generation/api/generation'

/** 头部只显示承接和合入的直接来源；完整祖先背景留在形成过程展示。 */
function ActionSources({ node, actions, users, onSelect }: { node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onSelect: (id: string) => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.uuid === id)).filter((action) => action !== undefined)
  const continuation = parents.find((parent) => parent.uuid === node.parentId)
  const merged = parents.filter((parent) => parent.uuid !== node.parentId)
  if (!parents.length) return null
  const sourceButton = (parent: ActionNode, relation: string) => <button key={parent.uuid} className="group inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm border-0 bg-transparent p-0 text-xs" type="button" title={parent.title} onClick={() => onSelect(parent.uuid)}>
    <span className="text-muted group-hover:text-ink">{relation}</span>
    <span className="font-medium tabular-nums text-signal group-hover:underline">#{parent.number}</span>
  </button>
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-line pl-3">
      {continuation && sourceButton(continuation, '承接')}
      {merged.length === 1 && sourceButton(merged[0], '合入')}
      {merged.length > 1 && <Popover.Root key={node.uuid}>
        <Popover.Trigger type="button" className="group inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm border-0 bg-transparent p-0 text-xs" title={`查看 ${merged.length} 个合入节点`}>
          <span className="text-muted group-hover:text-ink">合入</span>
          <span className="font-medium tabular-nums text-signal group-hover:underline">{merged.length} 个节点</span>
          <ChevronDown size={12} className="text-muted group-hover:text-signal" />
        </Popover.Trigger>
        <Popover.Portal><Popover.Content className="z-50 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-app" align="start" sideOffset={8} collisionPadding={12}>
          <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted">合入节点 · {merged.length}</div>
          <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {merged.map((parent) => {
              const authorName = users.find((user) => user.uuid === parent.authorId)?.name ?? parent.authorId
              return (
                <Popover.Close asChild key={parent.uuid}>
                  <button className="group block w-full rounded border-0 bg-transparent px-2 py-2 text-left hover:bg-soft focus-visible:outline-2 focus-visible:outline-signal" type="button" title={`查看合入节点 #${parent.number}：${parent.title}`} onClick={() => onSelect(parent.uuid)}>
                    <span className="flex items-baseline gap-2 text-sm leading-5">
                      <span className="shrink-0 font-medium tabular-nums text-signal">#{parent.number}</span>
                      <span className="min-w-0 truncate group-hover:text-signal" title={parent.title}>{parent.title}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs leading-5 text-muted">{authorName}</span>
                  </button>
                </Popover.Close>
              )
            })}
          </div>
        </Popover.Content></Popover.Portal>
      </Popover.Root>}
    </div>
  )
}

/** 当前节点阅读区：行动、表达、约定三个平行文档 tab；草稿通过 AI 对话编辑。 */
export function ActionDetail({ node, actions, users, author, isHighlightTip, onHighlight, onHide, onLocate, recordMode, onModeChange, onOpenArchive, onContinue, onSelect, onEditExpression, onEditAgreement, terminal = false, canDelete = false, onDelete, documents = [], documentsLoading = false, documentsError = '', onRegenerateDocuments, regenerating = false, isAuthor = false }: {
  node: ActionNode
  actions: ActionNode[]
  users: UserProfile[]
  author?: UserProfile
  isHighlightTip: boolean
  onHighlight: () => void
  onHide: () => void
  onLocate: () => void
  recordMode: ActionDocumentMode
  onModeChange: (mode: ActionDocumentMode) => void
  onOpenArchive: () => void
  onContinue: () => void
  onSelect: (nodeId: string) => void
  onEditExpression: (node: ActionNode) => void
  onEditAgreement: (node: ActionNode) => void
  terminal?: boolean
  canDelete?: boolean
  onDelete?: () => void
  documents?: NodeDocument[]
  documentsLoading?: boolean
  documentsError?: string
  onRegenerateDocuments?: () => void
  regenerating?: boolean
  isAuthor?: boolean
}) {
  const objectiveMarkdown = node.objectiveMarkdown ?? node.markdown
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const level = levels.get(node.uuid)
  const authorName = author?.name ?? node.authorId
  const [deleteOpen, setDeleteOpen] = useState(false)
  const nodeReady = node.nodeReady !== false
  const documentFor = (kind: 'expression' | 'agreement') => documents.find((document) => document.kind === kind)
  const statusFor = (kind: 'expression' | 'agreement') => documentFor(kind)?.status
    ?? (kind === 'expression' ? node.expressionStatus : node.agreementStatus)
    ?? ((kind === 'expression' ? node.expressionMarkdown : node.agreementMarkdown)?.trim() ? 'published' : 'pending')
  const tabStatusClass = (status?: string) => status === 'failed' ? 'bg-coral' : status === 'published' || !status ? 'hidden' : status === 'pending' || status === 'generating' ? 'bg-warning animate-pulse' : 'bg-warning'
  const tabs: { key: ActionDocumentMode; label: string }[] = [
    { key: 'objective', label: '行动' },
    { key: 'expression', label: '表达' },
    { key: 'agreement', label: '约定' },
  ]
  const renderDocument = (kind: 'expression' | 'agreement') => {
    const published = (kind === 'expression' ? node.expressionMarkdown : node.agreementMarkdown)?.trim() ?? ''
    const document = documentFor(kind)
    const draft = document?.draftMarkdown?.trim() ?? ''
    const status = statusFor(kind)
    if (published) return <MarkdownContent markdown={published} showImageCaptions={false} />
    if (!isAuthor) return <div className="flex min-h-40 items-center justify-center text-sm text-muted">作者正在完成{kind === 'expression' ? '表达' : '约定'}，尚未发布。</div>
    if (documentsError) return <p className="py-5 text-sm text-coral">{documentsError}</p>
    if (documentsLoading && !document) return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" />正在读取{kind === 'expression' ? '表达' : '约定'}状态…</div>
    if (status === 'failed' || document?.status === 'failed') return <div className="min-h-40 py-5"><p className="text-sm font-medium text-coral">AI 生成失败</p><p className="mt-2 text-sm leading-6 text-muted">{document?.errorMessage ?? '请稍后重试生成。'}</p>{isAuthor && onRegenerateDocuments && <button className="quiet-button mt-4" type="button" disabled={regenerating} onClick={onRegenerateDocuments}>{regenerating ? '重新生成中…' : '重新生成表达和约定'}</button>}</div>
    if (draft) return <div><div className="mb-4 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-md bg-signal-soft px-2.5 py-1 text-xs font-medium text-signal">AI 草案 · 尚未发布</span>{isAuthor && onRegenerateDocuments && <button className="text-button text-xs" type="button" disabled={regenerating} onClick={onRegenerateDocuments}>{regenerating ? '重新生成中…' : '重新生成'}</button>}</div><MarkdownContent markdown={draft} showImageCaptions={false} /></div>
    if (status === 'pending' || status === 'generating') return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" />AI 正在生成{kind === 'expression' ? '表达' : '约定'}草稿…</div>
    return <p className="py-5 text-sm text-muted">还没有{kind === 'expression' ? '表达' : '约定'}。</p>
  }
  const menuItemClass = 'flex w-full cursor-default select-none items-center gap-2 rounded px-2.5 py-2 text-left text-sm text-ink outline-none data-[highlighted]:bg-soft data-[highlighted]:text-signal'
  const moreMenu = (showDelete = false) => <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><button className="icon-button ml-auto" type="button" title="更多操作"><Ellipsis size={17} /></button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-md border border-line bg-surface p-1 shadow-app">
      <DropdownMenu.Item className={menuItemClass} onSelect={onOpenArchive}><MessageCircle size={15} />查看形成过程</DropdownMenu.Item>
      {showDelete && canDelete && onDelete && <><DropdownMenu.Separator className="my-1 h-px bg-line" /><DropdownMenu.Item className="flex w-full cursor-default select-none items-center gap-2 rounded px-2.5 py-2 text-left text-sm text-coral outline-none data-[highlighted]:bg-soft" onSelect={() => setDeleteOpen(true)}><Trash2 size={15} />删除节点</DropdownMenu.Item></>}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>
  const renderFooter = () => {
    if (recordMode === 'objective') {
      if (!nodeReady) return <>
        <span className="text-xs text-muted">{isAuthor ? '表达和约定都发布后，节点才能被接续' : '表达或约定尚未发布，节点暂不可接续'}</span>
        {moreMenu(false)}
      </>
      return <>
        <button className="primary-button" type="button" onClick={onContinue}><ArrowRight size={16} />接续行动</button>
        {moreMenu(true)}
      </>
    }
    const kind = recordMode
    const published = (kind === 'expression' ? node.expressionMarkdown : node.agreementMarkdown)?.trim() ?? ''
    const document = documentFor(kind)
    const draft = document?.draftMarkdown?.trim() ?? ''
    if (published) return <>
      {terminal && <button className="quiet-button" type="button" onClick={() => kind === 'expression' ? onEditExpression(node) : onEditAgreement(node)}>编辑{kind === 'expression' ? '表达' : '约定'}</button>}
      {moreMenu(false)}
    </>
    if (!isAuthor) return <span className="text-xs text-muted">作者尚未发布{kind === 'expression' ? '表达' : '约定'}</span>
    if (document?.status === 'failed' || draft) return <button className="primary-button" type="button" onClick={() => kind === 'expression' ? onEditExpression(node) : onEditAgreement(node)}>编辑{kind === 'expression' ? '表达' : '约定'}</button>
    return <span className="text-xs text-muted">AI 正在生成{kind === 'expression' ? '表达' : '约定'}草稿…</span>
  }
  return (
    <article>
      <header className="px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4 text-xs leading-5 text-muted">
          <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="text-[13px] font-medium tabular-nums text-ink">节点 #{node.number}</span>{level !== undefined && <span>第 {level} 层</span>}</span>
            <ActionSources node={node} actions={actions} users={users} onSelect={onSelect} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className={`icon-button ${isHighlightTip ? 'border-signal bg-signal-soft text-signal' : ''}`} title="高亮链路" onClick={onHighlight}><Route size={16} /></button>
            <DetailPanelControls onHide={onHide} onLocate={onLocate} locateLabel="定位此节点" />
          </div>
        </div>
        <h3 className="mt-2 text-xl font-semibold leading-[1.55] tracking-[-.02em] text-ink">{node.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
          <ProfilePreview profile={author} userId={node.authorId} className="inline-flex min-w-0 items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(node.authorId)}&fromGraph=${encodeURIComponent(node.graphId)}&fromTab=explore`}><Avatar profile={author} label={authorName.slice(0, 1)} size="small" /><span className="max-w-[180px] truncate text-sm font-medium">{authorName}</span></ProfilePreview>
          <time dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
        </div>
      </header>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-6 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-5">{tabs.map((tab) => {
          const status = tab.key === 'objective' ? 'published' : statusFor(tab.key)
          return <button key={tab.key} className={`inline-flex min-h-8 items-center gap-1.5 border-0 bg-transparent px-0 py-1 text-sm font-medium transition-colors ${recordMode === tab.key ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" onClick={() => onModeChange(tab.key)}>{tab.label}<span className={`size-1.5 rounded-full ${tabStatusClass(status)}`} /></button>
        })}</div>
        <HelpPopover title="行动、表达与约定"><p>三个文档属于同一个节点：行动是事实，表达是面向他人的兴趣和态度，约定是未来什么行动会引起作者兴趣。</p><p>表达和约定由 AI 生成草稿，作者分别发布；两者都发布后节点才能被接续。被接续后不可再修改。</p></HelpPopover>
      </div>
      <div className="action-reading-document px-6 py-5">
        {recordMode === 'objective' ? <MarkdownContent markdown={objectiveMarkdown} images={node.images} showImageCaptions={false} /> : renderDocument(recordMode)}
        {recordMode === 'agreement' && <div className="mt-8 border-t border-line pt-4"><ActionSourceAgreements node={node} actions={actions} users={users} onSelect={onSelect} /></div>}
      </div>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 pb-6 pt-1">{renderFooter()}</footer>
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 text-ink shadow-app outline-none">
            <AlertDialog.Title className="text-base font-semibold">删除这个行动节点？</AlertDialog.Title>
            <AlertDialog.Description className="mt-3 break-words text-sm leading-[1.8] text-muted">将删除「{node.title}」及其表达和约定。该节点必须尚未被接续；删除后无法恢复。</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2"><AlertDialog.Cancel asChild><button className="quiet-button" type="button">取消</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="primary-button !bg-coral !text-white" type="button" onClick={onDelete}>确认删除</button></AlertDialog.Action></div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </article>
  )
}
