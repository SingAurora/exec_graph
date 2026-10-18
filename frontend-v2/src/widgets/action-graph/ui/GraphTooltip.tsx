import { createPortal } from 'react-dom'
import type { ActionNode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'

/** Both pointer hover and keyboard focus reveal the same graph information. */
export type GraphHover = { kind: 'node' | 'reference'; id: string; left: number; top: number }

type Props = {
  id: string
  hover: GraphHover
  node?: ActionNode
  reference?: ActionReference
  users: Map<string, UserProfile>
  historyCount: number
  levels: Map<string, number>
}

function summarize(markdown: string) {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, '').replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim()
}

/** Compact previews stay outside the graph's scroll clipping boundary. */
export function GraphTooltip({ id, hover, node, reference, users, historyCount, levels }: Props) {
  if (!node && !reference) return null
  const status = reference?.agreementStatus
  const author = node ? users.get(node.authorId) : undefined
  return createPortal(<div id={id} role="tooltip" className="action-graph-tooltip" style={{
    left: Math.max(12, Math.min(hover.left + 12, window.innerWidth - 320)),
    top: Math.max(12, Math.min(hover.top - 20, window.innerHeight - 424)),
  }}>
    {node && <>
      <div className="action-graph-tooltip-kicker">节点 #{node.number} · 第{levels.get(node.id)}层</div>
      <h4>{node.title}</h4>
      <div className="action-graph-tooltip-author"><Avatar profile={author} label={author?.name.slice(0, 1) ?? node.authorId.slice(0, 1)} size="compact" /><strong>{author?.name ?? node.authorId}</strong><time dateTime={node.createdAt}>{node.createdAt.replace('T', ' ').slice(5, 16)}</time></div>
      <div className="action-graph-tooltip-preview"><p className="post-summary-clamp">{summarize(node.objectiveMarkdown ?? node.markdown)}</p>{node.images[0] && <img src={node.images[0].url} alt={node.images[0].alt} />}</div>
      <div className="action-graph-tooltip-meta">{historyCount ? `历史背景：引用链中的 ${historyCount} 次行动` : '起始节点 · 没有历史行动背景'}</div>
      {node.agreementMarkdown && <div className="action-graph-tooltip-agreement"><span>引用约定</span><p className="post-summary-clamp">{summarize(node.agreementMarkdown)}</p></div>}
    </>}
    {reference && <>
      <div className="action-graph-tooltip-kicker">{reference.incorporated ? '合入背景' : '承接行动'} · {reference.sameAuthor ? '同一作者引用' : '跨作者引用'}</div>
      <h4>第 {levels.get(reference.source.id)} 层 → 第 {levels.get(reference.target.id)} 层</h4>
      <p className="action-graph-tooltip-meta">节点 #{reference.source.number} → #{reference.target.number}</p>
      <p className="action-graph-tooltip-meta">{users.get(reference.source.authorId)?.name ?? reference.source.authorId} → {users.get(reference.target.authorId)?.name ?? reference.target.authorId}</p>
      <div className="action-graph-tooltip-agreement"><span>来源约定</span><p className="post-summary-clamp">{reference.source.agreementMarkdown ? summarize(reference.source.agreementMarkdown) : '未设置引用约定'}</p></div>
      <div className={`action-graph-tooltip-status ${status === 'exception' ? 'is-exception' : status === 'satisfied' ? 'is-satisfied' : ''}`}>
        {status === 'exception' ? '× 不满足原约定' : status === 'satisfied' ? '满足约定' : status === 'unreviewed' ? '尚未记录约定核对结果' : '可以直接引用'}
      </div>
      {status === 'exception' && <>
        <p className="action-graph-tooltip-reason">{reference.exceptionReason ?? '未说明例外原因。'}</p>
        <div className="action-graph-tooltip-meta">{reference.authorization === 'self-approved' ? '自己引用自己 · 例外自动同意'
          : reference.authorization === 'author-approved' ? '来源作者已同意此次例外' : '等待来源作者同意'}</div>
      </>}
    </>}
  </div>, document.body)
}
