import { useMemo, type ReactNode } from 'react'
import { useInfiniteList } from '../../../shared/lib/useInfiniteList'
import { getReferenceAgreementAuthorId, getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import type { ActionReference } from '../../../entities/action/lib/references'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { getMarkdownImages } from '../../../shared/lib/document-images'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { RecordThumbnails } from '../../../shared/ui/RecordThumbnails'

type Props = {
  references: ActionReference[]
  users: UserProfile[]
  active: boolean
  infinite?: boolean
  searchQuery?: string
  emptyContent?: ReactNode
  presentation?: 'default' | 'feed'
  onExplore: (reference: ActionReference) => void
  renderContext?: (reference: ActionReference) => ReactNode
}

/** 展示“谁以行动满足了谁的约定”；正文进入真实引用箭头，人物与图片保留独立交互。 */
export function AgreementResponseList({ references, users, active, infinite = true, searchQuery, emptyContent, presentation = 'default', onExplore, renderContext }: Props) {
  const feed = presentation === 'feed'
  const responses = useMemo(() => getSatisfiedAgreementResponses(references), [references])
  // 配图必须来自被满足的那份约定，不能借用回应行动或新设置的后续约定图片。
  const agreementImages = useMemo(() => new Map(responses.map((reference) => [reference.id, getMarkdownImages(reference.agreement.markdown)])), [responses])
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const { visibleCount, endRef, hasMore } = useInfiniteList({ itemCount: responses.length, infinite, active })

  if (!responses.length && emptyContent) return <div className="empty-state" role="status">{emptyContent}</div>
  if (!responses.length) return <p className="py-16 text-center text-[17px]" role="status">暂无满足约定的跨用户引用</p>
  return <div className="min-w-0">
    <section aria-label="约定回应列表">
      {(infinite ? responses.slice(0, visibleCount) : responses).map((reference) => {
        const responder = usersById.get(reference.target.authorId)
        const agreementAuthorId = getReferenceAgreementAuthorId(reference)
        const agreementAuthor = usersById.get(agreementAuthorId)
        const origin = reference.agreement.sourceNode
        const inherited = origin && origin.id !== reference.source.id
        const viaAuthor = usersById.get(reference.source.authorId)
        const summary = getMarkdownSummary(reference.agreement.markdown)
        // 底层整条点击区域与上层资料／图片入口分离，避免嵌套按钮和点头像却误跳转图详情。
        return <article className={`group relative isolate min-w-0 px-1 ${feed ? 'py-4' : 'py-5'}`} key={reference.id} data-reference-id={reference.id}>
          <button className="absolute inset-0 z-0 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left transition hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button"
            aria-label={`查看约定回应：节点 #${reference.source.number} → #${reference.target.number}`} onClick={() => onExplore(reference)} />
          <div className="pointer-events-none relative">
            {!feed && renderContext && <div className="pointer-events-auto relative z-10 mb-2 w-fit">{renderContext(reference)}</div>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm leading-6">
              <ProfileLink id={reference.target.authorId} profile={responder} />
              <span className="text-muted">满足了</span>
              <ProfileLink id={agreementAuthorId} profile={agreementAuthor} />
              <span className="text-muted">的约定</span>
            </div>
            <blockquote className="mt-3 border-l-2 border-signal/25 pl-3">
              <p className="post-summary-clamp text-sm leading-[1.85] text-copy"><HighlightedText text={searchQuery ? getSearchExcerpt(summary, searchQuery) : summary} query={searchQuery} /></p>
            </blockquote>
            <RecordThumbnails images={agreementImages.get(reference.id) ?? []} />
            {!feed && inherited && <p className="pointer-events-auto relative z-10 mt-2 cursor-text text-xs leading-5 text-muted">经由{viaAuthor?.name ?? reference.source.authorId}的节点 #{reference.source.number} · 约定来源 #{origin.number}</p>}
            <h3 className="mt-3 truncate text-sm font-medium leading-[1.7] text-ink group-hover:text-signal" title={reference.target.title}>行动：<HighlightedText text={reference.target.title} query={searchQuery} /></h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted">
              <time className="pointer-events-auto relative z-10 cursor-text" dateTime={reference.target.createdAt} title={formatFullPublicationTime(reference.target.createdAt)}>{formatPublicationTime(reference.target.createdAt)}</time>
              {!feed && <span className="pointer-events-auto relative z-10 cursor-text">节点 #{reference.target.number}</span>}
              {feed && renderContext && <div className="pointer-events-auto relative z-10 min-w-0 max-w-full">{renderContext(reference)}</div>}
            </div>
          </div>
        </article>
      })}
    </section>
    {infinite && <p ref={endRef} className="py-8 text-center text-xs leading-5 text-muted" role="status">{hasMore ? '加载中…' : '没有更多了'}</p>}
  </div>
}

function ProfileLink({ id, profile }: { id: string; profile?: UserProfile }) {
  const name = profile?.name ?? id
  return <ProfilePreview profile={profile} userId={id} className="pointer-events-auto relative z-10 inline-flex max-w-full items-center gap-2 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
    <Avatar profile={profile} label={name} size="compact" /><strong className="truncate text-sm font-medium">{name}</strong>
  </ProfilePreview>
}
