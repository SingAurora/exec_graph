import { MessageCircle, ScrollText } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActiveGraphActivities } from '../../../entities/project/lib/activity'
import { GraphContextLink } from '../../../entities/project/ui/GraphContextLink'
import { searchDiscoveryAgreements, searchDiscoveryExpressions } from '../../../features/search-discovery/lib/search'
import { DiscoverySearch } from '../../../features/search-discovery/ui/DiscoverySearch'
import type { Project } from '../../../entities/project/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { RecentGraphsAside } from './RecentGraphsAside'

type DiscoveryTab = 'expressions' | 'agreements'
const tabLabels: Record<DiscoveryTab, string> = { expressions: '表达', agreements: '约定' }
type Props = {
  actions: ActionNode[]
  projects: Project[]
  users: UserProfile[]
  active: boolean
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onOpenProject: (id: string) => void
  onSearchGraphs: (keyword: string) => void
}

/** 跨图发现表达与约定回应，两个栏目分别保留搜索内容、加载数量和阅读位置。 */
export function Discovery({ actions, projects, users, active, onOpenNode, onOpenReference, onOpenProject, onSearchGraphs }: Props) {
  const [tab, setTab] = useState<DiscoveryTab>('expressions')
  const [queries, setQueries] = useState<Record<DiscoveryTab, string>>({ expressions: '', agreements: '' })
  const query = queries[tab].trim()
  const scrollPositions = useRef<Partial<Record<DiscoveryTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const publicActions = useMemo(() => actions.filter((node) => projectsById.has(node.projectId)), [actions, projectsById])
  const expressions = useMemo(() => getPublishedExpressions(publicActions), [publicActions])
  const agreements = useMemo(() => getSatisfiedAgreementResponses(getActionReferences(publicActions)), [publicActions])
  const graphs = useMemo(() => getActiveGraphActivities(projects, publicActions), [projects, publicActions])
  const visibleExpressions = useMemo(() => searchDiscoveryExpressions(expressions, publicActions, users, queries.expressions), [expressions, publicActions, users, queries.expressions])
  const visibleAgreements = useMemo(() => searchDiscoveryAgreements(agreements, users, queries.agreements), [agreements, users, queries.agreements])
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
  const emptySearch = (scope: DiscoveryTab) => queries[scope].trim() ? <p>没有找到相关{tabLabels[scope]}</p> : undefined
  const context = (node: ActionNode) => <GraphContextLink id={node.projectId} title={projectsById.get(node.projectId)?.title} onOpen={onOpenProject} />

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
        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
          <div className="min-w-0">
            <TabsContent value="expressions" keepMounted><ActionPostList key={queries.expressions.trim()} nodes={visibleExpressions} actions={publicActions} users={users} mode="expression" presentation="feed" searchQuery={queries.expressions.trim()} emptyContent={emptySearch('expressions')} infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
            <TabsContent value="agreements" keepMounted><AgreementResponseList key={queries.agreements.trim()} references={visibleAgreements} users={users} presentation="feed" searchQuery={queries.agreements.trim()} emptyContent={emptySearch('agreements')} active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={(reference) => context(reference.target)} /></TabsContent>
          </div>
          <RecentGraphsAside items={graphs} projects={projects} actions={publicActions} onOpen={onOpenProject} onSearchAll={onSearchGraphs} />
        </div>
      </TabsRoot>
    </section>
  )
}
