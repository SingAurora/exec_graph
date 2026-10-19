import { Bookmark, Rss, UsersRound } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionNode, ActionDocumentMode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getFollowedActivity } from '../../../entities/following/lib/activity'
import type { FollowedSources } from '../../../entities/following/model/types'
import type { Project, UserProfile } from '../../../shared/model'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActivityFeed } from '../../feed/ActivityFeed'
import { FollowedDirectory } from './FollowedDirectory'

type FollowingTab = 'activity' | 'graphs' | 'users'
type Props = {
  actions: ActionNode[]
  projects: Project[]
  users: UserProfile[]
  sources: FollowedSources
  active: boolean
  onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onSetGraphFollow: (id: string, following: boolean) => boolean
  onSetUserFollow: (id: string, following: boolean) => boolean
}

/** Retains followed activity, graph and people directories across navigation. */
export function Following({ sources, actions, projects, users, active, onOpenProject, onOpenNode, onOpenReference, onSetGraphFollow, onSetUserFollow }: Props) {
  const [tab, setTab] = useState<FollowingTab>('activity')
  const scrollPositions = useRef<Partial<Record<FollowingTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const followedGraphs = projects.filter((project) => sources.graphIds.includes(project.id))
  const followedUsers = [...new Map(users.filter((user) => sources.userIds.includes(user.id)).map((user) => [user.id, user])).values()]
  const activity = useMemo(() => getFollowedActivity(actions, sources), [actions, sources])
  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [tab, active])
  const switchTab = (next: FollowingTab) => {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    pendingScroll.current = scrollPositions.current[next] ?? 0
    setTab(next)
  }
  const directoryProps = { projects: followedGraphs, users: followedUsers, actions, onOpenProject, onSetGraphFollow, onSetUserFollow }
  return <TabsRoot value={tab} onValueChange={(value) => switchTab(value as FollowingTab)}>
    <TabsList label="关注分类" showDivider={false}>
      <TabsTrigger value="activity"><span className="inline-flex items-center gap-1.5"><Rss size={16} />动态</span></TabsTrigger>
      <TabsTrigger value="graphs"><span className="inline-flex items-center gap-1.5"><Bookmark size={16} />图<span className="ml-0.5 text-xs tabular-nums text-muted">{followedGraphs.length}</span></span></TabsTrigger>
      <TabsTrigger value="users"><span className="inline-flex items-center gap-1.5"><UsersRound size={16} />用户<span className="ml-0.5 text-xs tabular-nums text-muted">{followedUsers.length}</span></span></TabsTrigger>
    </TabsList>
    <TabsContent value="activity" keepMounted><div className="pt-4">
      <div hidden={!followedGraphs.length && !followedUsers.length}><ActivityFeed actions={activity.actions} allActions={actions} projects={projects} users={users} agreementResponses={activity.agreementResponses} active={active && tab === 'activity'} compactTabs onOpenProject={onOpenProject} onOpenNode={onOpenNode} onOpenReference={onOpenReference} /></div>
      {!followedGraphs.length && !followedUsers.length && <div className="empty-state" role="status"><Bookmark size={24} strokeWidth={1.5} /><p>还没有关注的图或用户</p><a href="#home" className="quiet-button">去发现</a></div>}
    </div></TabsContent>
    <TabsContent value="graphs" keepMounted><FollowedDirectory {...directoryProps} kind="graphs" /></TabsContent>
    <TabsContent value="users" keepMounted><FollowedDirectory {...directoryProps} kind="users" /></TabsContent>
  </TabsRoot>
}
