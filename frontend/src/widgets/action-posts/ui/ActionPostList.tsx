import { useMemo, type ReactNode } from 'react'
import { useInfiniteList } from '../../../shared/lib/useInfiniteList'
import { getActionExpression, getActionExpressionOrigin } from '../../../entities/action/lib/expressions'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { getActionContextIds } from '../../../entities/action/lib/graph'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { ExpressionSource } from '../../../entities/action/ui/ExpressionContent'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { RecordThumbnails } from '../../../shared/ui/RecordThumbnails'
import { ListEmptyState } from '../../../shared/ui/empty-state/EmptyState'
import { ListEnd } from '../../../shared/ui/ListEnd'

type ActionPostListProps = {
  nodes: ActionNode[]
  actions: ActionNode[]
  users: UserProfile[]
  mode: ActionDocumentMode
  searchQuery?: string
  infinite?: boolean
  active?: boolean
  presentation?: 'default' | 'feed'
  showEnd?: boolean
  onExplore: (node: ActionNode, mode: ActionDocumentMode) => void
  renderContext?: (node: ActionNode) => ReactNode
}

/** 表达／行动共用内容条目；文档、用户资料和图片各有独立入口，不互相触发跳转。 */
export function ActionPostList({ nodes, actions, users, mode, searchQuery, infinite = false, active = true, presentation = 'default', showEnd, onExplore, renderContext }: ActionPostListProps) {
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const contextCounts = useMemo(() => presentation === 'feed' && mode === 'expression'
    ? new Map(nodes.map((node) => [node.uuid, getActionContextIds(actions.filter((action) => action.graphId === node.graphId), node.uuid).size]))
    : new Map<string, number>(), [actions, nodes, mode, presentation])
  const { visibleCount, endRef, hasMore } = useInfiniteList({ itemCount: nodes.length, infinite, active })

  if (!nodes.length) return <ListEmptyState />
  return (
    <div className="min-w-0">
      <section>
        {(infinite ? nodes.slice(0, visibleCount) : nodes).map((node) => <ActionPostItem key={node.uuid} node={node} level={levels.get(node.uuid)} contextCount={contextCounts.get(node.uuid)} actions={actions} users={users} mode={mode} searchQuery={searchQuery} presentation={presentation} onExplore={onExplore} renderContext={renderContext} />)}
      </section>
      {(showEnd ?? infinite) && <ListEnd ref={endRef} hasMore={infinite && hasMore} className="py-8" />}
    </div>
  )
}

function ActionPostItem({ node, level, contextCount, actions, users, mode, searchQuery, presentation, onExplore, renderContext }: Omit<ActionPostListProps, 'nodes' | 'infinite' | 'active'> & { node: ActionNode; level: number | undefined; contextCount?: number }) {
  const feed = presentation === 'feed'
  const author = users.find((user) => user.uuid === node.authorId)
  const expression = mode === 'expression' ? getActionExpression(actions, node.uuid) : undefined
  const sourceAuthorId = expression?.sourceNode?.expressionSupplement?.authorId ?? expression?.sourceNode?.authorId
  const sourceAuthor = users.find((user) => user.uuid === sourceAuthorId)
  const previewImages = expression ? (expression.markdown.trim() ? expression.sourceNode?.images ?? [] : []) : node.images
  const markdown = expression?.markdown ?? node.objectiveMarkdown ?? node.markdown
  const summary = getMarkdownSummary(markdown, node.title)
  const excerpt = searchQuery ? getSearchExcerpt(summary, searchQuery) : summary
  const openDocument = () => onExplore(node, mode)
  const documentLabel = mode === 'expression' ? '表达' : '行动'
  return (
    <article className={`group relative isolate min-w-0 px-1 ${feed ? 'py-4' : 'py-5'}`} data-node-id={node.uuid}>
      <button className="absolute inset-0 z-0 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" title={`阅读全文：${documentLabel} · ${node.title}`} onClick={openDocument} />
      <div className="pointer-events-none relative">
        {!feed && renderContext && <div className="pointer-events-auto relative z-10 mb-2 w-fit">{renderContext(node)}</div>}
        {!feed && <h3 className="truncate text-base font-semibold leading-[1.6] tracking-[-.02em] group-hover:text-signal" title={node.title}><HighlightedText text={node.title} query={searchQuery} /></h3>}
        <div className={`${feed ? '' : 'mt-2'} flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted`}>
          <ProfilePreview profile={author} userId={node.authorId} className="pointer-events-auto relative z-10 inline-flex items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            <Avatar profile={author} label={(author?.name ?? node.authorId).slice(0, 1)} size="compact" /><strong className="text-sm font-medium">{author?.name ?? node.authorId}</strong>
          </ProfilePreview>
          <time className="pointer-events-auto relative z-10 cursor-text" dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>{!feed && level !== undefined && <span className="pointer-events-auto relative z-10 cursor-text">第{level}层</span>}
        </div>
        <div className="mt-3">
          {feed && mode === 'objective' && <h3 className="mb-1.5 truncate text-base font-semibold leading-[1.6] group-hover:text-signal" title={node.title}><HighlightedText text={node.title} query={searchQuery} /></h3>}
          {!feed && expression && <ExpressionSource origin={getActionExpressionOrigin(actions, node.uuid)} />}
          <p className={`post-summary-clamp leading-[1.85] ${feed && expression ? 'text-base font-medium text-ink group-hover:text-signal' : `text-sm ${summary ? 'text-copy' : 'text-muted'}`}`}><HighlightedText text={excerpt || `暂无${documentLabel}`} query={searchQuery} /></p>
          <RecordThumbnails images={previewImages} />
        </div>
        {feed && <>
          {expression && <p className="mt-2.5 truncate text-xs leading-5 text-muted" title={node.title}>最近行动：<HighlightedText text={node.title} query={searchQuery} /></p>}
          {expression && sourceAuthorId && sourceAuthorId !== node.authorId && <p className="text-xs leading-5 text-muted">沿用{sourceAuthor?.name ?? sourceAuthorId}的表达</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
            {renderContext && <div className="pointer-events-auto relative z-10 min-w-0 max-w-full">{renderContext(node)}</div>}
            {contextCount !== undefined && <span>{contextCount} 次行动支撑</span>}
          </div>
        </>}
      </div>
    </article>
  )
}
