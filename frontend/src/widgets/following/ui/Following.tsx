import { Bookmark, MessageCircle, ScrollText, UsersRound } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ActionNode, ActionDocumentMode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getActionReferences } from '../../../entities/action/lib/references'
import { getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import { getFollowedAgreementRecipient } from '../../../entities/following/lib/activity'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import type { Graph } from '../../../entities/graph/model/types'
import { GraphContextLink } from '../../../entities/graph/ui/GraphContextLink'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { FollowedDirectory } from './FollowedDirectory'
import { ListSkeleton } from '../../../shared/ui/ListSkeleton'
import { followingKeys, followingTabKeys, readFollowing, readFollowingAgreements, readFollowingExpressions, readFollowingGraphs, readFollowingUsers } from '../../../entities/following/api/following'
import type { FollowedSources } from '../../../entities/following/model/types'

type FollowingTab = 'expressions' | 'agreements' | 'graphs' | 'users'
type Props = {
  scope: string
  sources?: FollowedSources
  active: boolean
  initialTab?: FollowingTab
  onOpenGraph: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onSetGraphFollow: (id: string, following: boolean) => boolean | Promise<boolean>
  onSetUserFollow: (id: string, following: boolean) => boolean | Promise<boolean>
}

/** 关注页按 Tab 懒加载：每个栏目只在自己激活时请求对应资源。 */
export function Following({ scope, active, initialTab = 'expressions', sources: sourcesProp, onOpenGraph, onOpenNode, onOpenReference, onSetGraphFollow, onSetUserFollow }: Props) {
  const [tab, setTab] = useState<FollowingTab>(initialTab)
  const scrollPositions = useRef<Partial<Record<FollowingTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)

  const sources = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: active && !sourcesProp })
  const expressions = useQuery({ queryKey: followingTabKeys.expressions(scope), queryFn: ({ signal }) => readFollowingExpressions(signal), enabled: active && tab === 'expressions' })
  const agreements = useQuery({ queryKey: followingTabKeys.agreements(scope), queryFn: ({ signal }) => readFollowingAgreements(signal), enabled: active && tab === 'agreements' })
  const graphsQuery = useQuery({ queryKey: followingTabKeys.graphs(scope), queryFn: ({ signal }) => readFollowingGraphs(signal), enabled: active && tab === 'graphs' })
  const usersQuery = useQuery({ queryKey: followingTabKeys.users(scope), queryFn: ({ signal }) => readFollowingUsers(signal), enabled: active && tab === 'users' })

  const source = sourcesProp ?? sources.data ?? { userUuids: [], graphUuids: [], users: [] }
  const followedUsers = useMemo(() => [...new Map([...source.users, ...(usersQuery.data?.items ?? [])].map((user) => [user.uuid, user])).values()], [source.users, usersQuery.data?.items])

  const expressionActions = useMemo(() => expressions.data?.actions ?? [], [expressions.data?.actions])
  const expressionNodes = useMemo(() => expressions.data?.items ?? [], [expressions.data?.items])
  const agreementActions = useMemo(() => agreements.data?.actions ?? [], [agreements.data?.actions])
  const agreementReferences = useMemo(() => {
    const selected = new Set((agreements.data?.items ?? []).map((item) => item.uuid))
    return getSatisfiedAgreementResponses(getActionReferences(agreementActions)).filter((reference) => selected.has(reference.target.uuid))
  }, [agreementActions, agreements.data?.items])

  const activeGraphs = useMemo<Graph[]>(() => tab === 'graphs' ? graphsQuery.data?.items ?? [] : tab === 'agreements' ? agreements.data?.graphs ?? [] : expressions.data?.graphs ?? [], [tab, graphsQuery.data?.items, expressions.data?.graphs, agreements.data?.graphs])
  const graphsById = useMemo(() => new Map(activeGraphs.map((graph) => [graph.uuid, graph])), [activeGraphs])

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

  const context = (node: ActionNode) => <GraphContextLink id={node.graphUuid} title={graphsById.get(node.graphUuid)?.title} onOpen={onOpenGraph} />
  const agreementContext = (reference: ActionReference) => {
    const recipientUuid = getFollowedAgreementRecipient(reference, source)
    const recipient = followedUsers.find((user) => user.uuid === recipientUuid)
    if (!recipientUuid) return context(reference.target)
    return (
      <div className="grid gap-1.5">{context(reference.target)}<p className="text-xs leading-5 text-muted">回应了你关注的 <ProfilePreview profile={recipient} userUuid={recipientUuid} className="rounded-sm text-xs hover:text-signal">{recipient?.name ?? recipientUuid}</ProfilePreview></p></div>
    )
  }

  const loading = (state: { isLoading: boolean; isError: boolean; error: unknown }) => state.isLoading
    ? <ListSkeleton rows={4} />
    : state.isError ? <p className="empty-state">{(state.error as Error)?.message ?? '加载失败'}</p> : null

  return (
    <TabsRoot value={tab} onValueChange={(value) => switchTab(value as FollowingTab)}>
      <div className="sticky top-0 z-20 mt-[23px] bg-paper">
        <TabsList showDivider={false} compact>
          <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
          <TabsTrigger value="agreements"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
          <TabsTrigger value="graphs" className="ml-5"><span className="inline-flex items-center gap-1.5"><Bookmark size={16} />图<span className="ml-0.5 text-xs tabular-nums text-muted">{source.graphUuids.length}</span></span></TabsTrigger>
          <TabsTrigger value="users"><span className="inline-flex items-center gap-1.5"><UsersRound size={16} />用户<span className="ml-0.5 text-xs tabular-nums text-muted">{source.userUuids.length}</span></span></TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="expressions" keepMounted className="pt-2">{loading(expressions) ?? <ActionPostList nodes={expressionNodes} actions={expressionActions} users={followedUsers} mode="expression" presentation="feed" infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} />}</TabsContent>
      <TabsContent value="agreements" keepMounted className="pt-2">{loading(agreements) ?? <AgreementResponseList references={agreementReferences} users={followedUsers} presentation="feed" active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={agreementContext} />}</TabsContent>
      <TabsContent value="graphs" keepMounted>{loading(graphsQuery) ?? <FollowedDirectory kind="graphs" graphs={graphsQuery.data?.items ?? []} users={followedUsers} actions={expressionActions} onOpenGraph={onOpenGraph} onSetGraphFollow={onSetGraphFollow} onSetUserFollow={onSetUserFollow} />}</TabsContent>
      <TabsContent value="users" keepMounted>{loading(usersQuery) ?? <FollowedDirectory kind="users" graphs={graphsQuery.data?.items ?? []} users={followedUsers} actions={expressionActions} onOpenGraph={onOpenGraph} onSetGraphFollow={onSetGraphFollow} onSetUserFollow={onSetUserFollow} />}</TabsContent>
    </TabsRoot>
  )
}
