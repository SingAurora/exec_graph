import { ArrowRight, ChevronDown, MessageCircle, Route } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useMemo } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionParentIds } from '../../../entities/action/lib/graph'
import { canEditActionExpression, getActionExpression, getActionExpressionOrigin } from '../../../entities/action/lib/expressions'
import { EditExpression } from '../../../features/action-expression/ui/EditExpression'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { ExpressionContent } from '../../../entities/action/ui/ExpressionContent'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { DetailPanelControls } from '../../../shared/ui/DetailPanelControls'
import { ActionOwnAgreement, ActionSourceAgreements } from './ActionAgreements'

/** Shows only direct sources; full historical context belongs to the formation archive. */
function ActionSources({ node, actions, users, onSelect }: { node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onSelect: (id: string) => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.id === id)).filter((action) => action !== undefined)
  const continuation = parents.find((parent) => parent.id === node.parentId)
  const merged = parents.filter((parent) => parent.id !== node.parentId)
  if (!parents.length) return null
  const sourceButton = (parent: ActionNode, relation: string) => <button key={parent.id} className="group inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm border-0 bg-transparent p-0 text-xs" type="button" aria-label={`查看${relation}节点 #${parent.number}`} title={parent.title} onClick={() => onSelect(parent.id)}>
    <span className="text-muted group-hover:text-ink">{relation}</span>
    <span className="font-medium tabular-nums text-signal group-hover:underline">#{parent.number}</span>
  </button>
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-line pl-3" aria-label="直接来源">
    {continuation && sourceButton(continuation, '承接')}
    {merged.length === 1 && sourceButton(merged[0], '合入')}
    {merged.length > 1 && <Popover.Root key={node.id}>
      <Popover.Trigger type="button" className="group inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm border-0 bg-transparent p-0 text-xs" aria-label={`查看 ${merged.length} 个合入节点`}>
        <span className="text-muted group-hover:text-ink">合入</span>
        <span className="font-medium tabular-nums text-signal group-hover:underline">{merged.length} 个节点</span>
        <ChevronDown size={12} className="text-muted group-hover:text-signal" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal><Popover.Content className="z-50 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-app" align="start" sideOffset={8} collisionPadding={12} aria-label="合入节点">
        <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted">合入节点 · {merged.length}</div>
        <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
          {merged.map((parent) => {
            const authorName = users.find((user) => user.id === parent.authorId)?.name ?? parent.authorId
            return <Popover.Close asChild key={parent.id}>
              <button className="group block w-full rounded border-0 bg-transparent px-2 py-2 text-left hover:bg-soft focus-visible:outline-2 focus-visible:outline-signal" type="button" aria-label={`查看合入节点 #${parent.number}：${parent.title}`} onClick={() => onSelect(parent.id)}>
                <span className="flex items-baseline gap-2 text-sm leading-5">
                  <span className="shrink-0 font-medium tabular-nums text-signal">#{parent.number}</span>
                  <span className="min-w-0 truncate group-hover:text-signal" title={parent.title}>{parent.title}</span>
                </span>
                <span className="mt-1 block truncate text-xs leading-5 text-muted">{authorName}</span>
              </button>
            </Popover.Close>
          })}
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>}
  </div>
}

/** Reads an action or effective expression, with compact metadata and a sticky document switch. */
export function ActionDetail({ node, actions, users, author, currentUserId, isHighlightTip, onHighlight, onHide, onLocate, recordMode, onModeChange, branches, onOpenArchive, onContinue, onSelect, onEditExpression, onUpdateAgreement }: {
  node: ActionNode
  actions: ActionNode[]
  users: UserProfile[]
  author?: UserProfile
  currentUserId?: string
  isHighlightTip: boolean
  onHighlight: () => void
  onHide: () => void
  onLocate: () => void
  recordMode: ActionDocumentMode
  onModeChange: (mode: ActionDocumentMode) => void
  branches: ActionNode[]
  onOpenArchive: () => void
  onContinue: () => void
  onSelect: (nodeId: string) => void
  onEditExpression: (node: ActionNode) => void
  onUpdateAgreement: (nodeId: string, markdown: string) => boolean | Promise<boolean>
}) {
  const objectiveMarkdown = node.objectiveMarkdown ?? node.markdown
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const level = levels.get(node.id)
  const expression = getActionExpression(actions, node.id)
  const hasExpression = Boolean(expression.markdown.trim())
  const activeMode = hasExpression ? recordMode : 'objective'
  const documentModes: ActionDocumentMode[] = hasExpression ? ['objective', 'expression'] : ['objective']
  const authorName = author?.name ?? node.authorId
  return <article>
    <header className="px-6 pb-4 pt-5">
      <div className="flex items-start justify-between gap-4 text-xs leading-5 text-muted">
        <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="text-[13px] font-medium tabular-nums text-ink">节点 #{node.number}</span>
            {level !== undefined && <span>第 {level} 层</span>}
          </span>
          <ActionSources node={node} actions={actions} users={users} onSelect={onSelect} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={`icon-button ${isHighlightTip ? 'border-signal bg-signal-soft text-signal' : ''}`} aria-label="高亮链路" aria-pressed={isHighlightTip} title="高亮链路" onClick={onHighlight}><Route size={16} aria-hidden="true" /></button>
          <DetailPanelControls onHide={onHide} onLocate={onLocate} locateLabel="定位此节点" />
        </div>
      </div>
      <h3 className="mt-2 text-xl font-semibold leading-[1.55] tracking-[-.02em] text-ink">{node.title}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
        <ProfilePreview profile={author} userId={node.authorId} className="inline-flex min-w-0 items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(node.authorId)}&fromGraph=${encodeURIComponent(node.projectId)}&fromTab=explore`}>
          <Avatar profile={author} label={authorName.slice(0, 1)} size="small" />
          <span className="max-w-[180px] truncate text-sm font-medium">{authorName}</span>
        </ProfilePreview>
        <time dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
      </div>
    </header>
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-6 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-5" role="group" aria-label="文档类型">
        {documentModes.map((mode) => <button key={mode} className={`min-h-8 border-0 bg-transparent px-0 py-1 text-sm font-medium transition-colors ${activeMode === mode ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={activeMode === mode} onClick={() => onModeChange(mode)}>{mode === 'objective' ? '行动' : '表达'}</button>)}
      </div>
      <HelpPopover title="行动与表达">
        <p>行动记录本次实际发生的事情；表达没有更新时沿用承接节点的表达，可以主动清空。合入来源不会自动覆盖表达。</p>
        <p>沿用的表达保留来源作者。“查看形成过程”可查看完整文档、上下文来源和 AI 对话。</p>
      </HelpPopover>
    </div>
    <div className="action-reading-document px-6 py-5">
      {activeMode === 'expression' ? <ExpressionContent expression={expression} origin={getActionExpressionOrigin(actions, node.id)} onSelectSource={(id) => { onSelect(id); onModeChange('expression') }} showImageCaptions={false} /> : <MarkdownContent markdown={objectiveMarkdown} images={node.images} showImageCaptions={false} />}
    </div>
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 pb-6 pt-1">
      <button className="primary-button" type="button" onClick={onContinue}><ArrowRight size={16} />接续行动</button>
      {canEditActionExpression(actions, node.id) && <EditExpression markdown={expression.markdown} onOpen={() => onEditExpression(node)} />}
      <button className="inline-flex min-h-9 items-center gap-1.5 border-0 bg-transparent px-0 text-sm text-muted hover:text-signal" type="button" onClick={onOpenArchive}><MessageCircle size={16} />查看形成过程</button>
    </footer>
    <section className="space-y-2 px-6 pb-6" aria-label="节点约定">
      <ActionOwnAgreement key={node.id} node={node} actions={actions} currentUserId={currentUserId} onSelect={onSelect} onUpdate={onUpdateAgreement ? (markdown) => onUpdateAgreement(node.id, markdown) : undefined} />
      <ActionSourceAgreements node={node} actions={actions} users={users} onSelect={onSelect} />
    </section>
    {branches.length > 0 && <section className="border-t border-line px-6 py-5" aria-label="后续行动">
      <h4 className="text-sm font-medium">后续行动 <span className="ml-1 text-xs font-normal text-muted">{branches.length}</span></h4>
      <div className="mt-2 divide-y divide-line">{branches.map((branch) => {
        const branchAuthor = users.find((user) => user.id === branch.authorId)
        return <div className="flex w-full items-center gap-3 py-3" key={branch.id}>
          <ProfilePreview profile={branchAuthor} userId={branch.authorId} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={branchAuthor} label={branchAuthor?.name ?? branch.authorId} size="small" /></ProfilePreview>
          <button className="group flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left" type="button" onClick={() => onSelect(branch.id)}>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-medium leading-6 group-hover:text-signal">{branch.title}</strong><span className="mt-1 block text-xs text-muted">{branchAuthor?.name ?? branch.authorId} · 节点 #{branch.number}</span></span>
            <ArrowRight size={15} className="shrink-0 text-muted group-hover:text-signal" />
          </button>
        </div>
      })}</div>
    </section>}
  </article>
}
