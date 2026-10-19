import { Footprints, MessageCircle, Network, ScrollText } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActiveGraphActivities } from '../../../entities/project/lib/activity'
import type { Project, UserProfile } from '../../../shared/model'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { GraphList } from '../../graphs/GraphList'
import { RecentGraphsAside } from './RecentGraphsAside'

type DiscoveryTab = 'expressions' | 'agreements' | 'actions' | 'graphs'
type Props = {
  actions: ActionNode[]
  projects: Project[]
  users: UserProfile[]
  active: boolean
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
  onOpenProject: (id: string) => void
}

/** Discovers public content across graphs, retaining each tab's loaded items and reading position. */
export function Discovery({ actions, projects, users, active, onOpenNode, onOpenReference, onOpenProject }: Props) {
  const [tab, setTab] = useState<DiscoveryTab>('expressions')
  const scrollPositions = useRef<Partial<Record<DiscoveryTab, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const publicActions = useMemo(() => actions.filter((node) => projectsById.has(node.projectId)), [actions, projectsById])
  const expressions = useMemo(() => getPublishedExpressions(publicActions), [publicActions])
  const facts = useMemo(() => sortActionsNewestFirst(publicActions), [publicActions])
  const agreements = useMemo(() => getSatisfiedAgreementResponses(getActionReferences(publicActions)), [publicActions])
  const graphs = useMemo(() => getActiveGraphActivities(projects, publicActions), [projects, publicActions])

  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [active, tab])
  const switchTab = (next: DiscoveryTab) => {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    pendingScroll.current = scrollPositions.current[next] ?? 0
    setTab(next)
  }
  const context = (node: ActionNode) => <button className="inline-flex max-w-full items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-left text-xs leading-5 text-muted hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" onClick={() => onOpenProject(node.projectId)}>
    <Network size={13} className="shrink-0" /><span className="line-clamp-1">{projectsById.get(node.projectId)?.title}</span>
  </button>

  return <section aria-label="发现内容">
    <TabsRoot value={tab} onValueChange={(value) => switchTab(value as DiscoveryTab)}>
      <TabsList label="发现分类" showDivider={false} sticky>
        <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
        <TabsTrigger value="agreements"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
        <TabsTrigger value="actions"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
        <TabsTrigger value="graphs"><span className="inline-flex items-center gap-1.5"><Network size={16} />图</span></TabsTrigger>
      </TabsList>
      <div className={tab === 'graphs' ? 'mt-5' : 'mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1'}>
        <div className="min-w-0">
          <TabsContent value="expressions" keepMounted><ActionPostList nodes={expressions} actions={publicActions} users={users} mode="expression" infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
          <TabsContent value="agreements" keepMounted><AgreementResponseList references={agreements} users={users} active={active && tab === 'agreements'} onExplore={onOpenReference} renderContext={(reference) => context(reference.target)} /></TabsContent>
          <TabsContent value="actions" keepMounted><ActionPostList nodes={facts} actions={publicActions} users={users} mode="objective" infinite active={active && tab === 'actions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
          <TabsContent value="graphs" keepMounted><GraphList items={graphs} infinite active={active && tab === 'graphs'} dividers={false} onOpen={onOpenProject} /></TabsContent>
        </div>
        {tab !== 'graphs' && <RecentGraphsAside items={graphs} onOpen={onOpenProject} />}
      </div>
    </TabsRoot>
  </section>
}
