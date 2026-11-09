import { MessageCircle, ScrollText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActiveGraphActivities } from '../../../entities/graph/lib/activity'
import { feedKeys, readFeed } from '../../../entities/action/api/feed'
import { ListSkeleton } from '../../../shared/ui/ListSkeleton'
import { GraphContextLink } from '../../../entities/graph/ui/GraphContextLink'
import { searchDiscoveryAgreements, searchDiscoveryExpressions } from '../../../features/search-discovery/lib/search'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import type { Graph } from '../../../entities/graph/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { RecentGraphsAside } from './RecentGraphsAside'

type DiscoveryTab = 'expressions' | 'agreements'
const tabLabels: Record<DiscoveryTab, string> = { expressions: '表达', agreements: '约定' }
type Props = {
  actions: ActionNode[]
  graphs: Graph[]
  users: UserProfile[]
  active: boolean
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onOpenGraph: (id: string) => void
  onSearchGraphs: (keyword: string) => void
  showRecentGraphs?: boolean
  /** 首页使用服务端内容流；游客页和已登录首页都可开启。 */
  remoteFeed?: boolean
}

/** 跨图发现表达与约定回应，两个栏目分别保留搜索内容、加载数量和阅读位置。 */
export function Discovery({ actions, graphs, users, active, onOpenNode, onOpenReference, onOpenGraph, onSearchGraphs, showRecentGraphs = true, remoteFeed = false }: Props) {
  const [tab, setTab] = useState<DiscoveryTab>('expressions')
  const [queries, setQueries] = useState<Record<DiscoveryTab, string>>({ expressions: '', agreements: '' })
  const query = queries[tab].trim()
  const scrollPositions = useRef<Partial<Record<DiscoveryTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const feed = useQuery({
    queryKey: feedKeys.page(tab),
    queryFn: ({ signal }) => readFeed(tab, 1, signal),
    enabled: remoteFeed && active,
  })
  const sourceActions = useMemo(() => remoteFeed ? (feed.data?.actions ?? []) : actions, [actions, feed.data?.actions, remoteFeed])
  const sourceGraphs = useMemo(() => remoteFeed ? (feed.data?.graphs ?? []) : graphs, [feed.data?.graphs, graphs, remoteFeed])
  const graphsById = useMemo(() => new Map(sourceGraphs.map((graph) => [graph.uuid, graph])), [sourceGraphs])
  const publicActions = useMemo(() => sourceActions.filter((node) => graphsById.has(node.graphUuid)), [sourceActions, graphsById])
  const sourceUsers = useMemo(() => {
    if (!remoteFeed) return users
    const byId = new Map(users.map((user) => [user.uuid, user]))
    for (const node of publicActions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    return [...byId.values()]
  }, [publicActions, remoteFeed, users])
  const expressions = useMemo(() => getPublishedExpressions(publicActions), [publicActions])
  const agreements = useMemo(() => getSatisfiedAgreementResponses(getActionReferences(publicActions)), [publicActions])
  const graphActivities = useMemo(() => getActiveGraphActivities(sourceGraphs, publicActions), [sourceGraphs, publicActions])
  const visibleExpressions = useMemo(() => searchDiscoveryExpressions(expressions, publicActions, sourceUsers, queries.expressions), [expressions, publicActions, sourceUsers, queries.expressions])
  const visibleAgreements = useMemo(() => searchDiscoveryAgreements(agreements, sourceUsers, queries.agreements), [agreements, sourceUsers, queries.agreements])
  const resultCounts: Record<DiscoveryTab, number> = { expressions: visibleExpressions.length, agreements: visibleAgreements.length }

  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [active, tab, query])
  const switchTab = (next: DiscoveryTab) => {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    pendingScroll.current = scrollPositions.current[next] ?? 0
    setTab(next)
  }
  const changeQuery = (value: string) => {
    if (value.trim() !== query) {
      scrollPositions.current[tab] = 0
      pendingScroll.current = 0
    }
    setQueries((previous) => ({ ...previous, [tab]: value }))
  }
  const context = (node: ActionNode) => <GraphContextLink id={node.graphUuid} title={graphsById.get(node.graphUuid)?.title} onOpen={onOpenGraph} />

  return (
    <section>
      <TabsRoot value={tab} onValueChange={(value) => switchTab(value as DiscoveryTab)}>
        <div className="sticky top-0 z-20 mt-[23px] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-paper pb-1">
          <TabsList showDivider={false} compact>
            <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
            <TabsTrigger value="agreements"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
          </TabsList>
          <DiscoverySearch label={tabLabels[tab]} value={queries[tab]} onChange={changeQuery} />
        </div>
        {query && <p className="mt-3 px-1 text-xs leading-5 text-muted">找到 {resultCounts[tab]} 条{tabLabels[tab]}</p>}
        {remoteFeed && feed.isLoading && <div className="pt-5"><ListSkeleton rows={3} /></div>}
        {remoteFeed && feed.error && <p className="mt-4 px-1 text-sm text-coral">{feed.error.message}</p>}
        {(!remoteFeed || !feed.isLoading) && <div className={showRecentGraphs ? "mt-1 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1" : "mt-1 grid grid-cols-1"}>
          <div className="min-w-0">
            <TabsContent value="expressions" keepMounted><ActionPostList key={queries.expressions.trim()} nodes={visibleExpressions} actions={publicActions} users={sourceUsers} mode="expression" presentation="feed" searchQuery={queries.expressions.trim()} infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
            <TabsContent value="agreements" keepMounted><AgreementResponseList key={queries.agreements.trim()} references={visibleAgreements} users={sourceUsers} presentation="feed" searchQuery={queries.agreements.trim()} active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={(reference) => context(reference.target)} /></TabsContent>
          </div>
          {showRecentGraphs && <RecentGraphsAside items={graphActivities} graphs={sourceGraphs} actions={publicActions} onOpen={onOpenGraph} onSearchAll={onSearchGraphs} />}
        </div>}
      </TabsRoot>
    </section>
  )
}
