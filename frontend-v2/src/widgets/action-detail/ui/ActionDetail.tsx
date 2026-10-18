import { ArrowRight, GitBranch, MessageCircle } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useMemo } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionParentIds } from '../../../entities/action/lib/graph'
import { getActionExpression } from '../../../entities/action/lib/expressions'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { ExpressionContent } from '../../../entities/action/ui/ExpressionContent'
import type { UserProfile } from '../../../shared/model'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { RecordImages } from '../../../shared/ui/RecordImages'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { DetailPanelControls } from '../../../shared/ui/DetailPanelControls'

/** Shows only direct sources; full historical context belongs to the formation archive. */
function ActionSources({ node, actions, onSelect }: { node: ActionNode; actions: ActionNode[]; onSelect: (id: string) => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.id === id)).filter((action) => action !== undefined)
  if (!parents.length) return null
  return <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted" aria-label="直接来源">
    {parents.slice(0, 3).map((parent) => <span key={parent.id}>
      {parent.id === node.parentId ? '承接' : '合入'} <button className="border-0 bg-transparent p-0 text-signal hover:underline" type="button" title={parent.title} onClick={() => onSelect(parent.id)}>#{parent.number}</button>
    </span>)}
    {parents.length > 3 && <Popover.Root>
      <Popover.Trigger className="border-0 bg-transparent p-0 text-signal hover:underline" aria-label={`查看其他 ${parents.length - 3} 个直接来源`}>+{parents.length - 3}</Popover.Trigger>
      <Popover.Portal><Popover.Content className="z-50 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-surface p-3 text-ink shadow-app" sideOffset={8} collisionPadding={12} aria-label="其他直接来源">
        {parents.slice(3).map((parent) => <Popover.Close asChild key={parent.id}><button className="block w-full rounded border-0 bg-transparent px-2 py-2 text-left text-sm hover:bg-soft hover:text-signal" type="button" onClick={() => onSelect(parent.id)}>#{parent.number} · {parent.title}</button></Popover.Close>)}
      </Popover.Content></Popover.Portal>
    </Popover.Root>}
  </div>
}

/** Reads an action or effective expression, with compact metadata and a sticky document switch. */
export function ActionDetail({ node, actions, users, author, isHighlightTip, onHighlight, onHide, onLocate, recordMode, onModeChange, branches, onOpenArchive, onContinue, onSelect }: {
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
  branches: ActionNode[]
  onOpenArchive: () => void
  onContinue: () => void
  onSelect: (nodeId: string) => void
}) {
  const objectiveMarkdown = node.objectiveMarkdown ?? node.markdown
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const level = levels.get(node.id)
  const expression = getActionExpression(actions, node.id)
  const authorName = author?.name ?? node.authorId
  return <article>
    <header className="px-6 pb-4 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted">
        <span>节点 #{node.number}{level !== undefined && ` · 第${level}层`}</span>
        <div className="flex items-center gap-3">
          <button type="button" className={`inline-flex min-h-7 items-center gap-1.5 border-0 bg-transparent p-0 text-xs hover:text-signal ${isHighlightTip ? 'text-signal' : 'text-muted'}`} aria-pressed={isHighlightTip} title="以此节点为终点高亮承接链路" onClick={onHighlight}><GitBranch size={14} aria-hidden="true" />高亮链路</button>
          <DetailPanelControls onHide={onHide} onLocate={onLocate} locateLabel="定位此节点" />
        </div>
      </div>
      <h3 className="mt-2 text-xl font-semibold leading-[1.55] tracking-[-.02em] text-ink">{node.title}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
        <a className="inline-flex min-w-0 items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(node.authorId)}&fromGraph=${encodeURIComponent(node.projectId)}&fromTab=explore`} aria-label={`查看${authorName}的主页`}>
          <Avatar profile={author} label={authorName.slice(0, 1)} size="small" />
          <span className="max-w-[180px] truncate text-sm font-medium">{authorName}</span>
        </a>
        <time dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
      </div>
      <ActionSources node={node} actions={actions} onSelect={onSelect} />
    </header>
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-6 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-5" role="group" aria-label="文档类型">
        {(['objective', 'expression'] as const).map((mode) => <button key={mode} className={`min-h-8 border-0 bg-transparent px-0 py-1 text-sm font-medium transition-colors ${recordMode === mode ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={recordMode === mode} onClick={() => onModeChange(mode)}>{mode === 'objective' ? '行动' : '表达'}</button>)}
      </div>
      <HelpPopover title="行动与表达">
        <p>行动记录本次实际发生的事情；表达没有更新时沿用承接节点的表达，可以主动清空。合入来源不会自动覆盖表达。</p>
        <p>沿用的表达保留来源作者。“查看形成过程”可查看完整文档、上下文来源和 AI 对话。</p>
      </HelpPopover>
    </div>
    <div className="action-reading-document px-6 py-5">
      {recordMode === 'expression' ? <ExpressionContent expression={expression} nodeId={node.id} users={users} showImageCaptions={false} /> : <><MarkdownContent markdown={objectiveMarkdown} /><RecordImages images={node.images} showCaptions={false} /></>}
    </div>
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 pb-6 pt-1">
      <button className="primary-button" type="button" onClick={onContinue}><ArrowRight size={16} />接续行动</button>
      <button className="inline-flex min-h-9 items-center gap-1.5 border-0 bg-transparent px-0 text-sm text-muted hover:text-signal" type="button" onClick={onOpenArchive}><MessageCircle size={16} />查看形成过程</button>
    </footer>
    {branches.length > 0 && <section className="border-t border-line px-6 py-5" aria-label="后续行动">
      <h4 className="text-sm font-medium">后续行动 <span className="ml-1 text-xs font-normal text-muted">{branches.length}</span></h4>
      <div className="mt-2 divide-y divide-line">{branches.map((branch) => {
        const branchAuthor = users.find((user) => user.id === branch.authorId)
        return <button className="group flex w-full items-center gap-3 border-0 bg-transparent py-3 text-left" type="button" key={branch.id} onClick={() => onSelect(branch.id)}>
          <Avatar profile={branchAuthor} label={(branchAuthor?.name ?? branch.authorId).slice(0, 1)} size="small" />
          <span className="min-w-0 flex-1"><strong className="block text-sm font-medium leading-6 group-hover:text-signal">{branch.title}</strong><span className="mt-1 block text-xs text-muted">{branchAuthor?.name ?? branch.authorId} · 节点 #{branch.number}</span></span>
          <ArrowRight size={15} className="shrink-0 text-muted group-hover:text-signal" />
        </button>
      })}</div>
    </section>}
  </article>
}
