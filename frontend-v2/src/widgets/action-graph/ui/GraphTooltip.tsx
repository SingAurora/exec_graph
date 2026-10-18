import { createPortal } from 'react-dom'
import type { ActionNode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'

/** Both pointer hover and keyboard focus reveal the same graph information. */
export type GraphHover = { kind: 'node' | 'reference'; id: string; left: number; top: number }

type Props = {
  id: string
  hover: GraphHover
  node?: ActionNode
  reference?: ActionReference
  users: Map<string, UserProfile>
  levels: Map<string, number>
}

/** Compact previews stay outside the graph's scroll clipping boundary. */
export function GraphTooltip({ id, hover, node, reference, users, levels }: Props) {
  if (!node && !reference) return null
  const status = reference?.agreementStatus
  const author = node ? users.get(node.authorId) : undefined
  return createPortal(<div id={id} role="tooltip" className="action-graph-tooltip" style={{
    left: Math.max(12, Math.min(hover.left + 12, window.innerWidth - 320)),
    top: Math.max(12, Math.min(hover.top - 20, window.innerHeight - 304)),
  }}>
    {node && <>
      <div className="action-graph-tooltip-kicker">节点 #{node.number} · 第{levels.get(node.id)}层</div>
      <h4>{node.title}</h4>
      <div className="action-graph-tooltip-author"><Avatar profile={author} label={author?.name.slice(0, 1) ?? node.authorId.slice(0, 1)} size="small" /><strong>{author?.name ?? node.authorId}</strong><time dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time></div>
      <div className="action-graph-tooltip-preview"><p className="post-summary-clamp">{getMarkdownSummary(node.objectiveMarkdown ?? node.markdown, node.title)}</p>{node.images[0] && <img src={node.images[0].url} alt={node.images[0].alt} />}</div>
    </>}
    {reference && <>
      <div className="action-graph-tooltip-kicker">{reference.incorporated ? '合入背景' : '承接行动'} · {reference.sameAuthor ? '同一作者引用' : '跨作者引用'}</div>
      <h4>第 {levels.get(reference.source.id)} 层 → 第 {levels.get(reference.target.id)} 层</h4>
      <p className="action-graph-tooltip-meta">节点 #{reference.source.number} → #{reference.target.number}</p>
      <p className="action-graph-tooltip-meta">{users.get(reference.source.authorId)?.name ?? reference.source.authorId} → {users.get(reference.target.authorId)?.name ?? reference.target.authorId}</p>
      <div className={`action-graph-tooltip-status ${status === 'exception' ? 'is-exception' : status === 'satisfied' ? 'is-satisfied' : ''}`}>
        {status === 'exception' ? '× 不满足原约定' : status === 'satisfied' ? '满足约定' : status === 'unreviewed' ? '尚未记录约定核对结果' : '可以直接引用'}
      </div>
    </>}
  </div>, document.body)
}
