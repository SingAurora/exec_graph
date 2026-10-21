import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'

type GraphDetailsAsideProps = {
  description: string
  createdAt: string
  actionCount: number
  lastActionAt?: string
  participantIds: string[]
  users: UserProfile[]
}

const creationDateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
const participantPreviewLimit = 5

/** Graph introduction, recent activity and participant profile links beside the lists. */
export function GraphDetailsAside({ description, createdAt, actionCount, lastActionAt, participantIds, users }: GraphDetailsAsideProps) {
  const creationDate = new Date(createdAt)
  const creationDateLabel = Number.isNaN(creationDate.getTime()) ? createdAt : creationDateFormatter.format(creationDate)
  const remainingParticipantCount = Math.max(0, participantIds.length - participantPreviewLimit)
  return <aside className="min-w-0 rounded-lg bg-soft p-4" aria-label="图资料">
    {description && <p className="whitespace-pre-line break-words text-sm leading-[1.7] text-copy">{description}</p>}
    <dl className={`grid gap-3 text-[13px] leading-5 ${description ? 'mt-5' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-muted">创建时间</dt>
        <dd className="text-right text-copy"><time dateTime={createdAt} title={formatFullPublicationTime(createdAt)}>{creationDateLabel}</time></dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-muted">累计行动</dt>
        <dd className="text-right tabular-nums text-ink">{actionCount} 条</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-muted">最近行动</dt>
        <dd className="text-right text-copy">{lastActionAt
          ? <time dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>{formatPublicationTime(lastActionAt)}</time>
          : '暂无'}</dd>
      </div>
    </dl>
    {participantIds.length > 0 && <section className="mt-5" aria-label="参与者">
      <h4 className="text-xs font-normal leading-5 text-muted">参与者</h4>
      <ul className="mt-2 flex flex-wrap gap-1">
        {participantIds.slice(0, participantPreviewLimit).map((id) => {
          const profile = users.find((user) => user.id === id)
          const name = profile?.name || id
          return <li key={id} className="flex">
            <ProfilePreview profile={profile} userId={id} className="inline-flex rounded-lg transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
              <Avatar profile={profile} label={name} size="compact" />
            </ProfilePreview>
          </li>
        })}
        {remainingParticipantCount > 0 && <li className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-surface px-1 text-xs font-medium tabular-nums text-muted" title={`还有 ${remainingParticipantCount} 位参与者`} aria-label={`还有 ${remainingParticipantCount} 位参与者`}>
          +{remainingParticipantCount}
        </li>}
      </ul>
    </section>}
  </aside>
}
