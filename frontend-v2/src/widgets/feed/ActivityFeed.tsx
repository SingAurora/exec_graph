import { Footprints, MessageCircle, Network } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getGraphActivity } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../entities/action/lib/expressions'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { ActionPostList } from '../action-posts/ui/ActionPostList'
import { GraphList } from '../graphs/GraphList'

type ActivityTab = 'expressions' | 'actions' | 'graphs'

/** One reading model for discovery, followed authors and personal contributions. */
export function ActivityFeed({ actions, allActions = actions, users, projects, authorIds, graphItems, active = true, tabRequest, onOpenNode, onOpenProject }: {
  actions: ActionNode[]; allActions?: ActionNode[]; users: UserProfile[]; projects: Project[]; authorIds?: string[]
  graphItems?: Project[]; active?: boolean
  tabRequest?: { value: ActivityTab }
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void; onOpenProject: (id: string) => void
}) {
  const [tab, setTab] = useState<ActivityTab>('expressions')
  useEffect(() => {
    if (tabRequest) setTab(tabRequest.value)
  }, [tabRequest])
  const scrollPositions = useRef<Partial<Record<ActivityTab, number>>>({})
  const switchTab = (value: string) => {
    if (value === tab) return
    scrollPositions.current[tab] = window.scrollY
    setTab(value as ActivityTab)
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[value as ActivityTab] ?? 0, behavior: 'instant' }))
  }
  const include = (node: ActionNode) => !authorIds || authorIds.includes(node.authorId)
  const expressions = getPublishedExpressions(allActions, authorIds).filter((node) => actions.some((action) => action.id === node.id))
  const facts = sortActionsNewestFirst(actions.filter(include))
  const context = (node: ActionNode) => <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs leading-5 text-muted hover:text-signal" type="button" onClick={() => onOpenProject(node.projectId)}><Network size={13} />{projects.find((project) => project.id === node.projectId)?.title ?? '行动图'}</button>
  return <TabsRoot value={tab} onValueChange={switchTab}>
    <TabsList label="动态分类" showDivider={false}>
      <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
      <TabsTrigger value="actions"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
      {graphItems && <TabsTrigger value="graphs"><span className="inline-flex items-center gap-1.5"><Network size={16} />图</span></TabsTrigger>}
    </TabsList>
    <TabsContent value="expressions" keepMounted><ActionPostList nodes={expressions} actions={allActions} users={users} mode="expression" infinite active={active && tab === 'expressions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
    <TabsContent value="actions" keepMounted><ActionPostList nodes={facts} actions={allActions} users={users} mode="objective" infinite active={active && tab === 'actions'} onExplore={onOpenNode} renderContext={context} /></TabsContent>
    {graphItems && <TabsContent value="graphs" keepMounted><GraphList items={graphItems.map((project) => getGraphActivity(project, allActions))} onOpen={onOpenProject} /></TabsContent>}
  </TabsRoot>
}
