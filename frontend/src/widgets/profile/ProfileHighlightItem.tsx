import type { ProfileHighlightEntry } from '../../entities/action/lib/profile-highlights'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project } from '../../entities/project/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { ProfilePreview } from '../../entities/profile/ui/ProfilePreview'
import { Avatar } from '../../shared/ui/Avatar'
import { RecordThumbnails } from '../../shared/ui/RecordThumbnails'
import { getMarkdownSummary } from '../../shared/lib/markdownSummary'
import { getMarkdownImages } from '../../shared/lib/document-images'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { ActionPostList } from '../action-posts/ui/ActionPostList'

/** 精选沿用表达流条目；附带约定采用约定流的引用摘要，人物、配图与正文各自交互。 */
export function ProfileHighlightItem({ entry: { node, agreement }, actions, projects, users, onOpenNode }: {
  entry: ProfileHighlightEntry
  actions: ActionNode[]
  projects: Project[]
  users: UserProfile[]
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const source = agreement.sourceNode
  const authorId = source?.agreementSupplement?.authorId ?? source?.authorId
  const author = users.find((user) => user.id === authorId)
  const publishedAt = source?.agreementSupplement?.createdAt ?? source?.createdAt
  return (
    <>
      <ActionPostList nodes={[node]} actions={actions} users={users} mode="expression" presentation="feed" onExplore={onOpenNode}
        renderContext={() => <button type="button" className="max-w-full truncate border-0 bg-transparent p-0 text-left text-xs text-muted hover:text-signal" onClick={() => onOpenNode(node, 'expression')} aria-label={`查看表达的行动背景：${node.title}`}>
          {projects.find((project) => project.id === node.projectId)?.title ?? node.title} · #{node.number}
        </button>} />
      {agreement.markdown.trim() && <section className="group relative isolate min-w-0 px-1 pb-4" aria-label="分支约定">
        <button type="button" className="absolute inset-0 z-0 w-full rounded-lg border-0 bg-transparent p-0 text-left transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" aria-label={`查看分支约定的行动背景：${node.title}`} onClick={() => onOpenNode(node, 'objective')} />
        <div className="pointer-events-none relative">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6">
            {authorId && <ProfilePreview profile={author} userId={authorId} className="pointer-events-auto relative z-10 inline-flex min-w-0 items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-signal">
              <Avatar profile={author} label={author?.name ?? authorId} size="compact" /><strong className="text-sm font-medium">{author?.name ?? authorId}</strong>
            </ProfilePreview>}
            <h4 className="text-sm font-normal text-muted">{authorId ? '的约定' : '约定'}</h4>
          </div>
          <blockquote className="mt-3 border-l-2 border-signal/25 pl-3"><p className="post-summary-clamp text-sm leading-[1.85] text-copy">{getMarkdownSummary(agreement.markdown)}</p></blockquote>
          <RecordThumbnails images={getMarkdownImages(agreement.markdown)} />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
            {publishedAt && <time className="pointer-events-auto relative z-10 cursor-text" dateTime={publishedAt} title={formatFullPublicationTime(publishedAt)}>{formatPublicationTime(publishedAt)}</time>}
            {source && <button type="button" className="pointer-events-auto relative z-10 border-0 bg-transparent p-0 text-xs text-muted hover:text-signal" aria-label={`查看约定来源节点 #${source.number}`} onClick={() => onOpenNode(source, 'objective')}>约定来源 #{source.number}</button>}
          </div>
        </div>
      </section>}
    </>
  )
}
