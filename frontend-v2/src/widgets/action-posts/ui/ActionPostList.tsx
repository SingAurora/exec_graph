import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getActionExpression, getActionExpressionOrigin } from '../../../entities/action/lib/expressions'
import { getActionLevels } from '../../../entities/action/lib/levels'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { ExpressionSource } from '../../../entities/action/ui/ExpressionContent'
import type { UserProfile } from '../../../shared/model'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { Avatar } from '../../../shared/ui/Avatar'
import { RecordThumbnails } from '../../../shared/ui/RecordThumbnails'

type ActionPostListProps = {
  nodes: ActionNode[]
  actions: ActionNode[]
  users: UserProfile[]
  mode: ActionDocumentMode
  searchQuery?: string
  infinite?: boolean
  active?: boolean
  onExplore: (node: ActionNode, mode: ActionDocumentMode) => void
  renderContext?: (node: ActionNode) => ReactNode
}

const pageSize = 6

/** Shows compact expressions or actions with separate document, profile, and image interactions. */
export function ActionPostList({ nodes, actions, users, mode, searchQuery, infinite = false, active = true, onExplore, renderContext }: ActionPostListProps) {
  const levels = useMemo(() => getActionLevels(actions), [actions])
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const endRef = useRef<HTMLParagraphElement>(null)
  const hasMore = infinite && visibleCount < nodes.length
  useEffect(() => {
    const end = endRef.current
    if (!active || !hasMore || !end) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setVisibleCount((count) => Math.min(count + pageSize, nodes.length))
    }, { rootMargin: '160px 0px' })
    observer.observe(end)
    return () => observer.disconnect()
  }, [active, hasMore, nodes.length, visibleCount])

  if (!nodes.length) return <div className="py-16 text-center" role="status">
    <h3 className="text-[17px]">{mode === 'expression' ? '暂无表达' : '暂无行动'}</h3>
  </div>
  return <div className="min-w-0">
    <section aria-label={mode === 'expression' ? '表达列表' : '行动列表'}>
      {(infinite ? nodes.slice(0, visibleCount) : nodes).map((node) => <ActionPostItem key={node.id} node={node} level={levels.get(node.id)} actions={actions} users={users} mode={mode} searchQuery={searchQuery} onExplore={onExplore} renderContext={renderContext} />)}
    </section>
    {infinite && <p ref={endRef} className="py-8 text-center text-xs leading-5 text-muted" role="status">{hasMore ? '加载中…' : '没有更多了'}</p>}
  </div>
}

function ActionPostItem({ node, level, actions, users, mode, searchQuery, onExplore, renderContext }: Omit<ActionPostListProps, 'nodes' | 'infinite' | 'active'> & { node: ActionNode; level: number | undefined }) {
  const author = users.find((user) => user.id === node.authorId)
  const expression = mode === 'expression' ? getActionExpression(actions, node.id) : undefined
  const previewImages = expression ? (expression.markdown.trim() ? expression.sourceNode?.images ?? [] : []) : node.images
  const markdown = expression?.markdown ?? node.objectiveMarkdown ?? node.markdown
  const summary = getMarkdownSummary(markdown, node.title)
  const excerpt = searchQuery ? getSearchExcerpt(summary, searchQuery) : summary
  const openDocument = () => onExplore(node, mode)
  const documentLabel = mode === 'expression' ? '表达' : '行动'
  return <article className="group relative isolate min-w-0 px-1 py-5" data-node-id={node.id}>
    <button className="absolute inset-0 z-0 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={`阅读全文：${documentLabel} · ${node.title}`} onClick={openDocument} />
    <div className="pointer-events-none relative">
      {renderContext && <div className="pointer-events-auto relative z-10 mb-2 w-fit">{renderContext(node)}</div>}
      <h3 className="truncate text-base font-semibold leading-[1.6] tracking-[-.02em] group-hover:text-signal" title={node.title}><HighlightedText text={node.title} query={searchQuery} /></h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
        <a className="pointer-events-auto relative z-10 inline-flex items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(node.authorId)}`} aria-label={`查看${author?.name ?? node.authorId}的主页`}>
          <Avatar profile={author} label={(author?.name ?? node.authorId).slice(0, 1)} size="compact" /><strong className="text-sm font-medium">{author?.name ?? node.authorId}</strong>
        </a>
        <time className="pointer-events-auto relative z-10 cursor-text" dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>{level !== undefined && <span className="pointer-events-auto relative z-10 cursor-text">第{level}层</span>}
      </div>
      <div className="mt-3">
        {expression && <ExpressionSource origin={getActionExpressionOrigin(actions, node.id)} />}
        <p className={`post-summary-clamp text-sm leading-[1.85] ${summary ? 'text-copy' : 'text-muted'}`}><HighlightedText text={excerpt || `暂无${documentLabel}`} query={searchQuery} /></p>
        <RecordThumbnails images={previewImages} />
      </div>
    </div>
  </article>
}
