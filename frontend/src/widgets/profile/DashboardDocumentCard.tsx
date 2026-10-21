import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import { GraphContextLink } from '../../entities/project/ui/GraphContextLink'
import type { Project } from '../../entities/project/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { getMarkdownSummary } from '../../shared/lib/markdownSummary'
import { RecordThumbnails } from '../../shared/ui/RecordThumbnails'
import { ActionPostList } from '../action-posts/ui/ActionPostList'

/** Shows actions by title and expressions by body, using each document's actual image source. */
export function DashboardDocumentCard({ node, actions, users, project, mode, compact = false, onOpenNode, onOpenProject }: {
  node: ActionNode; actions: ActionNode[]; users: UserProfile[]; project?: Project; mode: ActionDocumentMode
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void; onOpenProject: (id: string) => void
  compact?: boolean
}) {
  if (mode === 'expression') return <ActionPostList nodes={[node]} actions={actions} users={users} mode="expression" presentation="feed" onExplore={onOpenNode}
    renderContext={() => <GraphContextLink id={node.projectId} title={project?.title} onOpen={onOpenProject} />} />
  const markdown = node.objectiveMarkdown ?? node.markdown
  const images = node.images
  const summary = getMarkdownSummary(markdown, node.title)
  return <article className="group relative isolate min-w-0 rounded-md" data-node-id={node.id}>
    <button className="absolute inset-0 z-0 rounded-lg border-0 bg-transparent p-0 transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={`阅读全文：行动 · ${node.title}`} onClick={() => onOpenNode(node, mode)} />
    <div className="pointer-events-none relative flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h3 className={`line-clamp-2 font-semibold leading-6 tracking-tight group-hover:text-signal ${compact ? 'text-sm' : 'text-base'}`}>{node.title}</h3>
        {summary && <p className={`${compact ? 'mt-1 line-clamp-1' : 'mt-2 line-clamp-2'} text-sm leading-6 text-copy`}>{summary}</p>}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
          {project && <button className="pointer-events-auto min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-xs text-muted hover:text-signal" type="button" onClick={() => onOpenProject(project.id)}>{project.title}</button>}
          <time className="pointer-events-auto cursor-text" dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
        </div>
      </div>
      {images.length > 0 && <RecordThumbnails images={images} size={compact ? 'coverSmall' : 'cover'} />}
    </div>
  </article>
}
