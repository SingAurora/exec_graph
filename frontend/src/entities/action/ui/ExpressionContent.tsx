import type { ActionExpression, ActionExpressionOrigin } from '../model/types'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'

/** Displays an effective expression without substituting factual content for an empty one. */
export function ExpressionContent({ expression, origin, onSelectSource, showImageCaptions = true }: { expression: ActionExpression; origin?: ActionExpressionOrigin; onSelectSource?: (nodeId: string) => void; showImageCaptions?: boolean }) {
  if (!expression.markdown.trim()) return null
  return <div>
    <ExpressionSource origin={origin} onSelectSource={onSelectSource} />
    <MarkdownContent markdown={expression.markdown} images={expression.sourceNode?.images} showImageCaptions={showImageCaptions} />
  </div>
}

/** Labels the actual document origin without adding empty-state explanations. */
export function ExpressionSource({ origin, onSelectSource }: { origin?: ActionExpressionOrigin; onSelectSource?: (nodeId: string) => void }) {
  if (!origin) return null
  return <p className="mb-3 text-xs leading-5 text-muted">{origin.kind === 'modified' ? '修改自' : '继承自'}{' '}
    {onSelectSource ? <button type="button" className="rounded-sm border-0 bg-transparent p-0 text-xs text-signal hover:underline" onClick={() => onSelectSource(origin.node.id)} aria-label={`查看表达来源节点 #${origin.node.number}`}>节点 #{origin.node.number}</button> : <span>节点 #{origin.node.number}</span>}
  </p>
}
