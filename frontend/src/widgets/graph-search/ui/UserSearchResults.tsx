import type { UserProfile } from '../../../entities/profile/model/types'
import { Avatar } from '../../../shared/ui/Avatar'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'

/** User identities open a preview and retain the graph return destination in its profile links. */
export function UserSearchResults({ users, projectId, actionCounts, query }: {
  users: UserProfile[]
  projectId: string
  actionCounts: Map<string, number>
  query: string
}) {
  return (
    <ul className="mt-2">
      {users.map((user) => <li key={user.id}>
        <div className="flex items-start gap-3 rounded-lg px-1 py-5">
          <ProfilePreview profile={user} userId={user.id} href={`#profile?userId=${encodeURIComponent(user.id)}&fromGraph=${encodeURIComponent(projectId)}`} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={user} size="medium" /></ProfilePreview>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-5 text-ink"><ProfilePreview profile={user} userId={user.id} href={`#profile?userId=${encodeURIComponent(user.id)}&fromGraph=${encodeURIComponent(projectId)}`} className="hover:text-signal focus-visible:outline-2 focus-visible:outline-signal"><HighlightedText text={user.name} query={query} /></ProfilePreview></h3>
            {user.bio && <p className="mt-1 line-clamp-2 text-sm leading-[1.7] text-copy">{getMarkdownSummary(user.bio)}</p>}
            <p className="mt-2 text-xs text-muted">在本图记录了 {actionCounts.get(user.id) ?? 0} 次行动</p>
          </div>
        </div>
      </li>)}
    </ul>
  )
}
