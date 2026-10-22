import { Bookmark, MessageCircle, ScrollText, UsersRound } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionNode, ActionDocumentMode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getFollowedActivity, getFollowedAgreementRecipient } from '../../../entities/following/lib/activity'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import type { FollowedSources } from '../../../entities/following/model/types'
import { GraphContextLink } from '../../../entities/project/ui/GraphContextLink'
import type { Project } from '../../../entities/project/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { FollowedDirectory } from './FollowedDirectory'

type FollowingTab = 'expressions' | 'agreements' | 'graphs' | 'users'
type Props = {
  actions: ActionNode[]
  projects: Project[]
  users: UserProfile[]
  sources: FollowedSources
  active: boolean
  onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onSetGraphFollow: (id: string, following: boolean) => boolean | Promise<boolean>
  onSetUserFollow: (id: string, following: boolean) => boolean | Promise<boolean>
}

/** Retains followed activity, graph and people directories across navigation. */
export function Following({ sources, actions, projects, users, active, onOpenProject, onOpenNode, onOpenReference, onSetGraphFollow, onSetUserFollow }: Props) {
  const [tab, setTab] = useState<FollowingTab>('expressions')
  const scrollPositions = useRef<Partial<Record<FollowingTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const followedGraphs = projects.filter((project) => sources.graphIds.includes(project.id))
  const followedUsers = [...new Map(users.filter((user) => sources.userIds.includes(user.id)).map((user) => [user.id, user])).values()]
  const activity = useMemo(() => getFollowedActivity(actions, sources), [actions, sources])
  const hasSources = followedGraphs.length > 0 || followedUsers.length > 0
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
  const context = (node: ActionNode) => <GraphContextLink id={node.projectId} title={projects.find((project) => project.id === node.projectId)?.title} onOpen={onOpenProject} />
  const agreementContext = (reference: ActionReference) => {
    const recipientId = getFollowedAgreementRecipient(reference, sources)
    const recipient = users.find((user) => user.id === recipientId)
    if (!recipientId) return context(reference.target)
    return <div className="grid gap-1.5">{context(reference.target)}<p className="text-xs leading-5 text-muted">回应了你关注的 <ProfilePreview profile={recipient} userId={recipientId} className="rounded-sm text-xs hover:text-signal">{recipient?.name ?? recipientId}</ProfilePreview></p></div>
  }
  const emptyContent = (label: string) => hasSources
    ? <p>关注的用户和图暂无{label}</p>
    : <><Bookmark size={24} strokeWidth={1.5} /><p>还没有关注的图或用户</p><a href="#home" className="quiet-button">去发现</a></>
  return <TabsRoot value={tab} onValueChange={(value) => switchTab(value as FollowingTab)}>
    <div className="sticky top-0 z-20 mt-[23px] bg-paper">
      <TabsList label="关注分类" showDivider={false} compact>
        <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
        <TabsTrigger value="agreements"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
        <TabsTrigger value="graphs" className="ml-5"><span className="inline-flex items-center gap-1.5"><Bookmark size={16} />图<span className="ml-0.5 text-xs tabular-nums text-muted">{followedGraphs.length}</span></span></TabsTrigger>
        <TabsTrigger value="users"><span className="inline-flex items-center gap-1.5"><UsersRound size={16} />用户<span className="ml-0.5 text-xs tabular-nums text-muted">{followedUsers.length}</span></span></TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="expressions" keepMounted className="pt-2"><ActionPostList nodes={activity.expressions} actions={actions} users={users} mode="expression" presentation="feed" infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} emptyContent={emptyContent('表达')} /></TabsContent>
    <TabsContent value="agreements" keepMounted className="pt-2"><AgreementResponseList references={activity.agreementResponses} users={users} presentation="feed" active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={agreementContext} emptyContent={emptyContent('约定回应')} /></TabsContent>
    <TabsContent value="graphs" keepMounted><FollowedDirectory {...directoryProps} kind="graphs" /></TabsContent>
    <TabsContent value="users" keepMounted><FollowedDirectory {...directoryProps} kind="users" /></TabsContent>
  </TabsRoot>
}
