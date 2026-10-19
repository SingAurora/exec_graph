import { getActionExpression } from '../../entities/action/lib/expressions'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project } from '../../shared/model'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { getMarkdownSummary } from '../../shared/lib/markdownSummary'
import { RecordThumbnails } from '../../shared/ui/RecordThumbnails'

/** Shows actions by title and expressions by body, using each document's actual image source. */
export function DashboardDocumentCard({ node, actions, project, mode, compact = false, onOpenNode, onOpenProject }: {
  node: ActionNode; actions: ActionNode[]; project?: Project; mode: ActionDocumentMode
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void; onOpenProject: (id: string) => void
  compact?: boolean
}) {
  const expression = mode === 'expression' ? getActionExpression(actions.filter((action) => action.projectId === node.projectId), node.id) : undefined
  const markdown = expression?.markdown ?? node.objectiveMarkdown ?? node.markdown
  const images = expression ? expression.sourceNode?.images ?? [] : node.images
  const summary = getMarkdownSummary(markdown, node.title)
  return <article className="group relative isolate min-w-0 rounded-md" data-node-id={node.id}>
    <button className="absolute inset-0 z-0 rounded-lg border-0 bg-transparent p-0 transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={`阅读全文：${mode === 'expression' ? '表达' : '行动'} · ${node.title}`} onClick={() => onOpenNode(node, mode)} />
    <div className="pointer-events-none relative flex items-start gap-4">
      <div className="min-w-0 flex-1">
        {mode === 'objective' && <h3 className={`line-clamp-2 font-semibold leading-6 tracking-tight group-hover:text-signal ${compact ? 'text-sm' : 'text-base'}`}>{node.title}</h3>}
        {summary && <p className={mode === 'expression' ? 'line-clamp-3 text-sm leading-7 text-ink' : `${compact ? 'mt-1 line-clamp-1' : 'mt-2 line-clamp-2'} text-sm leading-6 text-copy`}>{summary}</p>}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
          {project && <button className="pointer-events-auto min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-xs text-muted hover:text-signal" type="button" onClick={() => onOpenProject(project.id)}>{project.title}</button>}
          {mode === 'expression' && <span className="pointer-events-auto cursor-text">节点 #{node.number}</span>}
          <time className="pointer-events-auto cursor-text" dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
        </div>
      </div>
      {images.length > 0 && <RecordThumbnails images={images} size={compact ? 'coverSmall' : 'cover'} />}
    </div>
  </article>
}
