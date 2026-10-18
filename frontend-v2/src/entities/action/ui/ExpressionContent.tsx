import type { ActionExpression } from '../model/types'
import type { UserProfile } from '../../../shared/model'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { RecordImages } from '../../../shared/ui/RecordImages'

/** Displays an effective expression without substituting factual content for an empty one. */
export function ExpressionContent({ expression, nodeId, users }: { expression: ActionExpression; nodeId: string; users: UserProfile[] }) {
  const empty = !expression.markdown.trim()
  return <div>
    <ExpressionSource expression={expression} nodeId={nodeId} users={users} />
    {empty ? <p className="py-3 text-sm text-muted">暂无表达</p> : <><MarkdownContent markdown={expression.markdown} /><RecordImages images={expression.sourceNode?.images ?? []} /></>}
  </div>
}

/** Attributes inherited expressions and explicit clears without rendering the document. */
export function ExpressionSource({ expression, nodeId, users }: { expression: ActionExpression; nodeId: string; users: UserProfile[] }) {
  const source = expression.sourceNode
  if (!source) return null
  const inherited = source.id !== nodeId
  const empty = !expression.markdown.trim()
  if (!inherited && !empty) return null
  const author = users.find((user) => user.id === source.authorId)
  return <p className="mb-3 text-xs leading-5 text-muted">{inherited ? '沿用' : '本节点'} · 节点 #{source.number} · {author?.name ?? source.authorId}{empty ? ' · 已清空表达' : ''}</p>
}
