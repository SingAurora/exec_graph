import { ArrowRight, GitBranch, MessageCircle } from 'lucide-react'
import { useMemo } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionContextIds, getActionParentIds } from '../../../entities/action/lib/graph'
import { getActionExpression } from '../../../entities/action/lib/expressions'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { ExpressionContent } from '../../../entities/action/ui/ExpressionContent'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { RecordImages } from '../../../shared/ui/RecordImages'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'

/** Shows only a compact set of direct sources instead of expanding the full history. */
export function ActionSources({ node, actions, onSelect }: { node: ActionNode; actions: ActionNode[]; onSelect: (id: string) => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.id === id)).filter((action) => action !== undefined)
  if (!parents.length) return null
  return <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-6 py-2.5 text-xs text-muted"><span>{parents.length > 1 ? '承接与合入' : '承接自'}</span>{parents.slice(0, 3).map((parent) => <button className="border-0 bg-transparent p-0 font-semibold text-signal hover:underline" type="button" key={parent.id} title={parent.title} onClick={() => onSelect(parent.id)}>节点 #{parent.number}</button>)}{parents.length > 3 && <span>等 {parents.length} 个直接来源</span>}</div>
}

/** Reads one node's facts or effective expression while keeping the documents separate. */
export function ActionDetail({ node, actions, users, author, isMain, recordMode, onModeChange, branches, onOpenArchive, onContinue, onFork, onSelect }: {
  node: ActionNode
  actions: ActionNode[]
  users: UserProfile[]
  author?: UserProfile
  isMain: boolean
  recordMode: ActionDocumentMode
  onModeChange: (mode: ActionDocumentMode) => void
  branches: ActionNode[]
  onOpenArchive: () => void
  onContinue: () => void
  onFork: () => void
  onSelect: (nodeId: string) => void
}) {
  const objectiveMarkdown = node.objectiveMarkdown ?? node.markdown
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const level = levels.get(node.id)
  const expression = getActionExpression(actions, node.id)
  const historyCount = getActionContextIds(actions, node.id).size - 1
  return <article><header className="border-b border-line px-6 py-[19px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><span className="section-kicker">{isMain ? '当前路线' : '其他路线'}</span><span className="font-sans text-xs font-bold text-muted">节点 #{node.number}{level !== undefined && ` · 第${level}层`}</span></div><h3 className="mt-[7px] text-xl tracking-[-.03em] max-[700px]:text-[20px]">{node.title}</h3><div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted">
      <span className="inline-flex min-w-0 items-center gap-2">
        <Avatar profile={author} label={(author?.name ?? node.authorId).slice(0, 1)} size="compact" />
        <span className="max-w-[180px] truncate text-sm font-medium leading-5 text-ink">{author?.name ?? node.authorId}</span>
      </span>
      <span className="text-xs" aria-hidden="true">·</span>
      <time className="text-xs leading-5" dateTime={node.createdAt}>{node.createdAt.replace('T', ' ').slice(0, 16)}</time>
    </div></header><div className="border-b border-line px-6 py-2 max-[700px]:px-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-5" role="group" aria-label="文档类型">
      <button className={`border-0 bg-transparent min-h-8 px-0 py-1 text-[13px] font-semibold transition-colors ${recordMode === 'objective' ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={recordMode === 'objective'} onClick={() => onModeChange('objective')}>事实</button>
      <button className={`border-0 bg-transparent min-h-8 px-0 py-1 text-[13px] font-semibold transition-colors ${recordMode === 'expression' ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={recordMode === 'expression'} onClick={() => onModeChange('expression')}>表达</button>
    </div><HelpPopover title="事实与表达">
      <p>事实记录本次行动实际发生的事情；表达没有更新时沿用承接节点的表达，可以主动清空。合入来源不会自动覆盖表达。</p>
      <p>沿用的表达保留来源作者。点击“查看形成过程”可查看完整文档、上下文来源和 AI 对话。</p>
    </HelpPopover></div>{recordMode === 'expression' && <p className="mb-3 mt-2 text-xs text-muted">引用背景：{historyCount} 个历史节点</p>}</div><div className="px-6 py-6 max-[700px]:px-4">{recordMode === 'expression' ? <ExpressionContent expression={expression} nodeId={node.id} users={users} /> : <MarkdownContent markdown={objectiveMarkdown} />}{recordMode === 'objective' && <RecordImages images={node.images} />}</div><div className="border-t border-line px-6 py-[15px] max-[700px]:px-4"><div className="flex flex-wrap items-center gap-2.5"><button className="primary-button" type="button" onClick={onContinue}><ArrowRight size={16} />沿此接续</button><button className="quiet-button" type="button" onClick={onFork}><GitBranch size={16} />另开支链</button><button className="quiet-button" type="button" onClick={onOpenArchive}><MessageCircle size={16} />查看形成过程</button></div></div>{branches.length > 0 && <section className="border-t border-line px-6 py-[18px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><div><span className="section-kicker">行动分支</span><h4 className="mt-1 text-[17px]">从这里继续的人</h4></div><span className="text-xs text-muted">{branches.length} 条路线</span></div><div className="mt-3 grid gap-2">{branches.map((branch) => <button className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-0 border-b border-line bg-transparent px-0 py-3 text-left hover:text-signal" type="button" key={branch.id} onClick={() => onSelect(branch.id)}><span className="grid gap-1"><strong className="text-xs">{branch.title}</strong><small className="text-xs text-muted">节点 #{branch.number} · {branch.authorId}</small></span><ArrowRight size={15} className="text-signal" /></button>)}</div></section>}</article>
}
