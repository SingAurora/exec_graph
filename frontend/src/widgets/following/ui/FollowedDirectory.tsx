import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getGraphActivity } from '../../../entities/graph/lib/activity'
import { GraphAvatar } from '../../../entities/graph/ui/GraphAvatar'
import { FollowButton } from '../../../features/follow/ui/FollowButton'
import type { Graph } from '../../../entities/graph/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { ListEmptyState } from '../../../shared/ui/empty-state/EmptyState'
import { ListEnd } from '../../../shared/ui/ListEnd'

type Props = {
  kind: 'graphs' | 'users'
  graphs: Graph[]
  users: UserProfile[]
  actions: ActionNode[]
  onOpenGraph: (id: string) => void
  onSetGraphFollow: (id: string, following: boolean) => boolean | Promise<boolean>
  onSetUserFollow: (id: string, following: boolean) => boolean | Promise<boolean>
}

/** Searchable followed objects with independent navigation and unsubscribe controls. */
export function FollowedDirectory({ kind, graphs, users, actions, onOpenGraph, onSetGraphFollow, onSetUserFollow }: Props) {
  const [query, setQuery] = useState('')
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const activities = useMemo(() => graphs.map((graph) => getGraphActivity(graph, actions))
    .sort((a, b) => Date.parse(b.lastActionAt ?? b.graph.createdAt) - Date.parse(a.lastActionAt ?? a.graph.createdAt)), [graphs, actions])
  const recentByUser = useMemo(() => {
    const latest = new Map<string, string>()
    for (const node of sortActionsNewestFirst(actions)) if (!latest.has(node.authorUuid)) latest.set(node.authorUuid, node.createdAt)
    return latest
  }, [actions])
  const people = [...users].sort((a, b) => Date.parse(recentByUser.get(b.uuid) ?? '1970-01-01') - Date.parse(recentByUser.get(a.uuid) ?? '1970-01-01') || a.name.localeCompare(b.name, 'zh-CN'))
  const items = kind === 'graphs' ? activities.filter(({ graph }) => matches(graph.title)) : people.filter((user) => matches(user.name))
  const total = kind === 'graphs' ? activities.length : users.length
  return (
    <section className="pt-5">
      {total > 0 && <label className="mb-2 flex h-10 max-w-sm items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-signal"><Search size={16} className="shrink-0 text-muted" /><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" type="search" title={kind === 'graphs' ? '搜索关注的图' : '搜索关注的用户'} placeholder={kind === 'graphs' ? '搜索图名称' : '搜索昵称'} value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
      {!items.length ? <ListEmptyState />
        : <>
        <ul>
          {kind === 'graphs' ? activities.filter(({ graph }) => matches(graph.title)).map(({ graph, lastActionAt }) => <li key={graph.uuid} className="flex items-start gap-4 py-5">
            <button type="button" className="group flex min-w-0 flex-1 items-start gap-3.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-signal" onClick={() => onOpenGraph(graph.uuid)}>
              <GraphAvatar graph={graph} />
              <span className="grid min-w-0 flex-1 gap-1.5"><strong className="text-base font-semibold leading-6 group-hover:text-signal">{graph.title}</strong>{graph.description && <span className="line-clamp-2 text-sm leading-6 text-copy">{graph.description}</span>}<RecentAction time={lastActionAt} /></span>
            </button>
            <FollowButton kind="graph" name={graph.title} following onChange={(next) => onSetGraphFollow(graph.uuid, next)} />
          </li>) : people.filter((user) => matches(user.name)).map((user) => <li key={user.uuid} className="flex items-start gap-4 py-5">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              <ProfilePreview profile={user} userUuid={user.uuid} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={user} size="medium" /></ProfilePreview>
              <div className="grid min-w-0 flex-1 gap-1.5"><ProfilePreview profile={user} userUuid={user.uuid} className="min-w-0 rounded-sm hover:text-signal focus-visible:outline-2 focus-visible:outline-signal"><strong className="text-base font-semibold leading-6">{user.name}</strong></ProfilePreview>{user.bio && <p className="line-clamp-2 text-sm leading-6 text-copy">{getMarkdownSummary(user.bio)}</p>}<RecentAction time={recentByUser.get(user.uuid)} /></div>
            </div>
            <FollowButton kind="user" name={user.name} following onChange={(next) => onSetUserFollow(user.uuid, next)} />
          </li>)}
        </ul>
        <ListEnd hasMore={false} className="py-6" />
        </>}
    </section>
  )
}

function RecentAction({ time }: { time?: string }) {
  return (
    <span className="text-xs leading-5 text-muted">{time ? <time dateTime={time} title={formatFullPublicationTime(time)}>最近行动 {formatPublicationTime(time)}</time> : '暂无行动'}</span>
  )
}
