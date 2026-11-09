import { Footprints, Home, MessageCircle, Network, ScrollText, Search } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { getGraphActivity } from '../../entities/graph/lib/activity'
import { GraphContextLink } from '../../entities/graph/ui/GraphContextLink'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../entities/action/lib/expressions'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { ActionReference } from '../../entities/action/lib/references'
import type { Graph } from '../../entities/graph/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../action-posts/ui/ActionPostList'
import { GraphList } from '../graphs/GraphList'
import { AgreementResponseList } from '../agreement-responses/ui/AgreementResponseList'
import { ProfileSearch } from '../profile-search/ui/ProfileSearch'
import { getRetainedTabScrollTop } from '../../shared/lib/tab-scroll'

export type ActivityTab = 'home' | 'expressions' | 'agreements' | 'actions' | 'graphs' | 'search'

/** Retains the public profile's document lists and reading positions. */
export function ActivityFeed({ actions, allActions = actions, users, graphs, authorUuids, graphItems, agreementResponses, active = true, compactTabs = false, tabRequest, tab: controlledTab, onTabChange, home, graphToolbar, onOpenNode, onOpenGraph, onOpenReference }: {
  actions: ActionNode[]; allActions?: ActionNode[]; users: UserProfile[]; graphs: Graph[]; authorUuids?: string[]
  graphItems?: Graph[]; active?: boolean; compactTabs?: boolean
  agreementResponses?: ActionReference[]
  tabRequest?: { value: ActivityTab }
  tab?: ActivityTab
  onTabChange?: (tab: ActivityTab) => void
  home?: (active: boolean) => ReactNode
  graphToolbar?: ReactNode
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void; onOpenGraph: (id: string) => void
  onOpenReference?: (reference: ActionReference) => void
}) {
  const [internalTab, setInternalTab] = useState<ActivityTab>(home ? 'home' : 'expressions')
  const tab = controlledTab ?? internalTab
  const changeTab = useCallback((next: ActivityTab) => { if (controlledTab === undefined) setInternalTab(next); onTabChange?.(next) }, [controlledTab, onTabChange])
  const contentRef = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (!tabRequest) return
    pendingScroll.current = undefined
    changeTab(tabRequest.value)
  }, [tabRequest, changeTab])
  const scrollPositions = useRef<Partial<Record<ActivityTab, number>>>({})
  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    // Restore after the new panel is laid out, before the browser paints its changed height.
    window.scrollTo({ top, behavior: 'instant' })
  }, [tab, active])
  const navigationTop = () => {
    const content = contentRef.current
    const navigation = navigationRef.current
    const margin = navigation ? parseFloat(window.getComputedStyle(navigation).marginTop) || 0 : 0
    return content ? content.getBoundingClientRect().top + window.scrollY + margin : window.scrollY
  }
  const switchTab = (value: string) => {
    if (value === tab) return
    const next = value as ActivityTab
    const currentTop = window.scrollY
    scrollPositions.current[tab] = currentTop
    pendingScroll.current = getRetainedTabScrollTop(scrollPositions.current[next], currentTop, navigationTop())
    changeTab(next)
  }
  const include = (node: ActionNode) => !authorUuids || authorUuids.includes(node.authorUuid)
  const expressions = getPublishedExpressions(allActions, authorUuids).filter((node) => actions.some((action) => action.uuid === node.uuid))
  const facts = sortActionsNewestFirst(actions.filter(include))
  const context = (node: ActionNode) => <GraphContextLink id={node.graphUuid} title={graphs.find((graph) => graph.uuid === node.graphUuid)?.title} onOpen={onOpenGraph} />
  return (
    <div ref={contentRef} className="[overflow-anchor:none]"><TabsRoot value={tab} onValueChange={switchTab} className="flow-root min-h-dvh">
      <div ref={navigationRef} className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-paper pb-1 ${compactTabs ? '' : 'mt-[23px]'}`}>
        <TabsList showDivider={false} compact>
          {home && <TabsTrigger value="home" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><Home size={16} />首页</span></TabsTrigger>}
          <TabsTrigger value="expressions" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
          {agreementResponses && onOpenReference && <TabsTrigger value="agreements" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>}
          <TabsTrigger value="actions" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
          {graphItems && <TabsTrigger value="graphs" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><Network size={16} />图</span></TabsTrigger>}
          <TabsTrigger value="search" compact={compactTabs}><span className="inline-flex items-center gap-1.5"><Search size={16} />搜索</span></TabsTrigger>
        </TabsList>
      </div>
      {home && <TabsContent value="home" keepMounted>{home(active && tab === 'home')}</TabsContent>}
      <TabsContent value="expressions" keepMounted><ActionPostList nodes={expressions} actions={allActions} users={users} mode="expression" presentation="feed" infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
      {agreementResponses && onOpenReference && <TabsContent value="agreements" keepMounted><AgreementResponseList references={agreementResponses} users={users} presentation="feed" active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={(reference) => context(reference.target)} /></TabsContent>}
      <TabsContent value="actions" keepMounted><ActionPostList nodes={facts} actions={allActions} users={users} mode="objective" infinite active={active && tab === 'actions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
      {graphItems && <TabsContent value="graphs" keepMounted>{graphToolbar}<GraphList items={graphItems.map((graph) => getGraphActivity(graph, allActions))} onOpen={onOpenGraph} infinite active={active && tab === 'graphs'} dividers={false} /></TabsContent>}
      <TabsContent value="search" keepMounted><ProfileSearch active={active && tab === 'search'} expressions={expressions} actions={facts} allActions={allActions} references={agreementResponses} graphs={graphItems} users={users} profileUuid={authorUuids?.length === 1 ? authorUuids[0] : undefined} onOpenNode={onOpenNode} onOpenReference={onOpenReference} onOpenGraph={onOpenGraph} renderContext={context} /></TabsContent>
    </TabsRoot></div>
  )
}
