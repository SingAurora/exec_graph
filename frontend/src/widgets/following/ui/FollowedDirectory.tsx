import { Bookmark, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getGraphActivity } from '../../../entities/project/lib/activity'
import { ProjectAvatar } from '../../../entities/project/ui/ProjectAvatar'
import { FollowButton } from '../../../features/follow/ui/FollowButton'
import type { Project, UserProfile } from '../../../shared/model'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'

type Props = {
  kind: 'graphs' | 'users'
  projects: Project[]
  users: UserProfile[]
  actions: ActionNode[]
  onOpenProject: (id: string) => void
  onSetGraphFollow: (id: string, following: boolean) => boolean
  onSetUserFollow: (id: string, following: boolean) => boolean
}

/** Searchable followed objects with independent navigation and unsubscribe controls. */
export function FollowedDirectory({ kind, projects, users, actions, onOpenProject, onSetGraphFollow, onSetUserFollow }: Props) {
  const [query, setQuery] = useState('')
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const graphs = useMemo(() => projects.map((project) => getGraphActivity(project, actions))
    .sort((a, b) => Date.parse(b.lastActionAt ?? b.project.createdAt) - Date.parse(a.lastActionAt ?? a.project.createdAt)), [projects, actions])
  const recentByUser = useMemo(() => {
    const latest = new Map<string, string>()
    for (const node of sortActionsNewestFirst(actions)) if (!latest.has(node.authorId)) latest.set(node.authorId, node.createdAt)
    return latest
  }, [actions])
  const people = [...users].sort((a, b) => Date.parse(recentByUser.get(b.id) ?? '1970-01-01') - Date.parse(recentByUser.get(a.id) ?? '1970-01-01') || a.name.localeCompare(b.name, 'zh-CN'))
  const items = kind === 'graphs' ? graphs.filter(({ project }) => matches(project.title)) : people.filter((user) => matches(user.name))
  const total = kind === 'graphs' ? projects.length : users.length
  const Icon = kind === 'graphs' ? Bookmark : UsersRound
  return <section className="pt-5" aria-label={kind === 'graphs' ? '关注的图' : '关注的用户'}>
    {total > 0 && <label className="mb-2 flex h-10 max-w-sm items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-signal"><Search size={16} className="shrink-0 text-muted" /><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" type="search" aria-label={kind === 'graphs' ? '搜索关注的图' : '搜索关注的用户'} placeholder={kind === 'graphs' ? '搜索图名称' : '搜索昵称'} value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
    {!items.length ? <div className="empty-state" role="status"><Icon size={24} strokeWidth={1.5} /><p>{total ? '没有找到匹配的结果' : kind === 'graphs' ? '还没有关注的图' : '还没有关注的用户'}</p>{!total && <a href="#home" className="quiet-button">去发现</a>}</div>
      : <ul aria-label={kind === 'graphs' ? '已关注图列表' : '已关注用户列表'}>
        {kind === 'graphs' ? graphs.filter(({ project }) => matches(project.title)).map(({ project, lastActionAt }) => <li key={project.id} className="flex items-start gap-4 py-5">
          <button type="button" className="group flex min-w-0 flex-1 items-start gap-3.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-signal" onClick={() => onOpenProject(project.id)}>
            <ProjectAvatar project={project} />
            <span className="grid min-w-0 flex-1 gap-1.5"><strong className="text-base font-semibold leading-6 group-hover:text-signal">{project.title}</strong>{project.description && <span className="line-clamp-2 text-sm leading-6 text-copy">{project.description}</span>}<RecentAction time={lastActionAt} /></span>
          </button>
          <FollowButton kind="graph" name={project.title} following onChange={(next) => onSetGraphFollow(project.id, next)} />
        </li>) : people.filter((user) => matches(user.name)).map((user) => <li key={user.id} className="flex items-start gap-4 py-5">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <ProfilePreview profile={user} userId={user.id} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={user} size="medium" /></ProfilePreview>
            <div className="grid min-w-0 flex-1 gap-1.5"><ProfilePreview profile={user} userId={user.id} className="min-w-0 rounded-sm hover:text-signal focus-visible:outline-2 focus-visible:outline-signal"><strong className="text-base font-semibold leading-6">{user.name}</strong></ProfilePreview>{user.bio && <p className="line-clamp-2 text-sm leading-6 text-copy">{getMarkdownSummary(user.bio)}</p>}<RecentAction time={recentByUser.get(user.id)} /></div>
          </div>
          <FollowButton kind="user" name={user.name} following onChange={(next) => onSetUserFollow(user.id, next)} />
        </li>)}
      </ul>}
  </section>
}

function RecentAction({ time }: { time?: string }) {
  return <span className="text-xs leading-5 text-muted">{time ? <time dateTime={time} title={formatFullPublicationTime(time)}>最近行动 {formatPublicationTime(time)}</time> : '暂无行动'}</span>
}
