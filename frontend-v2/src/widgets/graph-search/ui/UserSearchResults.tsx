import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { HighlightedText } from '../../../shared/ui/HighlightedText'

/** User results navigate only to profiles and preserve their graph return destination. */
export function UserSearchResults({ users, projectId, actionCounts, query }: {
  users: UserProfile[]
  projectId: string
  actionCounts: Map<string, number>
  query: string
}) {
  return <ul className="mt-2" aria-label="参与用户搜索结果">
    {users.map((user) => <li key={user.id}>
      <a className="flex items-start gap-3 rounded-lg px-1 py-5 hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(user.id)}&fromGraph=${encodeURIComponent(projectId)}`} aria-label={`查看${user.name}的主页`}>
        <Avatar profile={user} size="medium" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-5 text-ink"><HighlightedText text={user.name} query={query} /></h3>
          {user.bio && <p className="mt-1 line-clamp-2 text-sm leading-[1.7] text-copy">{user.bio}</p>}
          <p className="mt-2 text-xs text-muted">在本图记录了 {actionCounts.get(user.id) ?? 0} 次行动</p>
        </div>
      </a>
    </li>)}
  </ul>
}
