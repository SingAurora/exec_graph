import { Footprints, MessageCircle, Plus, Search, Settings2, Sparkles } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionDocumentMode, ActionNode } from '../entities/action/model/types'
import { getActionContextIds } from '../entities/action/lib/graph'
import { getActionExpressionNodes, sortActionsNewestFirst } from '../entities/action/lib/expressions'
import { getActionReferences } from '../entities/action/lib/references'
import { ActionGraph } from '../widgets/action-graph/ui/ActionGraph'
import { ActionDetail, ActionSources } from '../widgets/action-detail/ui/ActionDetail'
import { ActionReferenceDetail } from '../widgets/action-reference/ui/ActionReferenceDetail'
import type { BranchMode, Project, UserProfile } from '../shared/model'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../shared/ui/tabs/Tabs'
import { ProjectSettingsPanel } from '../features/project/ui/ProjectSettingsPanel'
import { ActionPostList } from '../widgets/action-posts/ui/ActionPostList'
import { ProjectHeader } from '../entities/project/ui/ProjectHeader'
import { GraphDetailsAside } from '../widgets/graph-details/ui/GraphDetailsAside'
import { GraphSearch } from '../widgets/graph-search/ui/GraphSearch'
import type { GraphBackgroundPreferences } from '../shared/ui/graph-background/model'

type ProjectPageProps = {
  project: Project
  active?: boolean
  currentUserId: string
  users: UserProfile[]
  actions: ActionNode[]
  showActionGraphLegend: boolean
  graphBackground: GraphBackgroundPreferences
  onCreateAction: (projectId: string) => void
  onContinueAction: (node: ActionNode, mode: BranchMode) => void
  onOpenActionArchive: (node: ActionNode) => void
  onUpdateProject: (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => void
}

type GraphSelection = { kind: 'node' | 'reference'; id: string }
type ProjectTab = 'expressions' | 'facts' | 'explore' | 'search' | 'settings'

export function ProjectPage({ project, active = true, currentUserId, users, actions, showActionGraphLegend, graphBackground, onCreateAction, onContinueAction, onOpenActionArchive, onUpdateProject }: ProjectPageProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const tabScroll = useRef<Partial<Record<ProjectTab, number>>>({})
  const pendingLocate = useRef(false)
  const lastTab = useRef<ProjectTab>('expressions')
  const wasActive = useRef(active)
  const openingProfile = useRef(false)
  const [activeTab, setActiveTab] = useState<ProjectTab>('expressions')
  const [visitedExplore, setVisitedExplore] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [documentMode, setDocumentMode] = useState<ActionDocumentMode>('objective')
  const expressionNodes = useMemo(() => getActionExpressionNodes(actions), [actions])
  const facts = useMemo(() => sortActionsNewestFirst(actions), [actions])
  const [routeTipId, setRouteTipId] = useState<string>()
  const routeTip = actions.find((node) => node.id === routeTipId) ?? expressionNodes[0] ?? facts[0]
  const mainPath = useMemo(() => {
    if (!routeTip) return []
    const contextIds = getActionContextIds(actions, routeTip.id)
    const context = actions.filter((node) => contextIds.has(node.id) && node.id !== routeTip.id).sort((a, b) => a.number - b.number)
    return [...context, routeTip]
  }, [actions, routeTip])
  const references = useMemo(() => getActionReferences(actions), [actions])
  const participantIds = [...new Set(actions.map((action) => action.authorId))]
  const contributorIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const action of actions) counts.set(action.authorId, (counts.get(action.authorId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
  }, [actions])
  const canEditProject = project.ownerId === currentUserId || contributorIds.includes(currentUserId)
  const [selection, setSelection] = useState<GraphSelection>()
  const selectedReference = selection?.kind === 'reference' ? references.find((reference) => reference.id === selection.id) : undefined
  const selected = selectedReference ? undefined : actions.find((node) => selection?.kind === 'node' && node.id === selection.id) ?? routeTip
  const selectNode = (id: string) => { setSelection({ kind: 'node', id }); setDocumentMode('objective') }

  const switchTab = (tab: ProjectTab) => {
    if (tab === activeTab) return
    tabScroll.current[activeTab] = window.scrollY
    if (tab === 'explore') setVisitedExplore(true)
    setActiveTab(tab)
  }
  useLayoutEffect(() => {
    if (!active) {
      if (wasActive.current && !openingProfile.current) tabScroll.current[activeTab] = window.scrollY
      wasActive.current = false
      return
    }
    const returning = !wasActive.current
    wasActive.current = true
    openingProfile.current = false
    if (lastTab.current === activeTab && !returning) return
    lastTab.current = activeTab
    const locate = pendingLocate.current && activeTab === 'explore'
    pendingLocate.current = false
    // Wait for the tab panels to finish changing visibility before aligning the page.
    const frame = window.requestAnimationFrame(() => {
      if (locate) {
        workspaceRef.current?.focus({ preventScroll: true })
        workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      } else {
        window.scrollTo({ top: tabScroll.current[activeTab] ?? 0, behavior: 'instant' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTab, active])

  const openInExplore = (node: ActionNode, mode: ActionDocumentMode) => {
    setRouteTipId(node.id)
    setSelection({ kind: 'node', id: node.id })
    setDocumentMode(mode)
    setFocusRequest((value) => value + 1)
    pendingLocate.current = true
    switchTab('explore')
  }
  const createAction = () => {
    const parent = selected ?? routeTip
    if (parent) onContinueAction(parent, 'continue')
    else onCreateAction(project.id)
  }

  return <section className="max-w-[1000px] pt-0 max-[700px]:pt-7" onClickCapture={(event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null
    if (link?.getAttribute('href')?.startsWith('#profile?')) {
      tabScroll.current[activeTab] = window.scrollY
      openingProfile.current = true
    }
  }}>
    <ProjectHeader project={project} participantCount={participantIds.length} expressionCount={expressionNodes.length} />
    <TabsRoot value={activeTab} onValueChange={(value) => switchTab(value as ProjectTab)}>
      <TabsList label="行动图内容" sticky showDivider={false}>
        <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
        <TabsTrigger value="facts"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
        <TabsTrigger value="explore"><span className="inline-flex items-center gap-1.5"><Sparkles size={16} />探索</span></TabsTrigger>
        <TabsTrigger value="search"><span className="inline-flex items-center gap-1.5"><Search size={16} />搜索</span></TabsTrigger>
        {canEditProject && <TabsTrigger value="settings"><span className="inline-flex items-center gap-1.5"><Settings2 size={16} />设置</span></TabsTrigger>}
      </TabsList>
      {(['expressions', 'facts'] as const).map((tab) => <TabsContent key={tab} value={tab} keepMounted>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
          <ActionPostList nodes={tab === 'expressions' ? expressionNodes : facts} actions={actions} users={users} mode={tab === 'expressions' ? 'expression' : 'objective'} onExplore={openInExplore} onCreate={createAction} />
          <GraphDetailsAside description={project.description} createdAt={project.createdAt} actionCount={actions.length} lastActionAt={facts[0]?.createdAt} participantIds={participantIds} users={users} />
        </div>
      </TabsContent>)}
      <TabsContent value="search" keepMounted>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
          <GraphSearch projectId={project.id} actions={actions} users={users} onExplore={openInExplore} />
          <GraphDetailsAside description={project.description} createdAt={project.createdAt} actionCount={actions.length} lastActionAt={facts[0]?.createdAt} participantIds={participantIds} users={users} />
        </div>
      </TabsContent>
      <TabsContent value="explore" keepMounted={visitedExplore}>
        {!actions.length ? <EmptyActions onCreate={() => onCreateAction(project.id)} /> : <div ref={workspaceRef} className="mt-5 grid h-[calc(100dvh-44px)] scroll-mt-11 grid-cols-[342px_minmax(0,1fr)] overflow-hidden border border-line bg-surface outline-none" role="region" tabIndex={-1} aria-label="行动阅读工作区">
          <ActionGraph actions={actions} mainPath={mainPath} users={users} selectedId={selected?.id} selectedReferenceId={selectedReference?.id} showLegend={showActionGraphLegend} background={graphBackground} active={active && activeTab === 'explore'} focusRequest={focusRequest} onSelect={selectNode} onSelectReference={(id) => setSelection({ kind: 'reference', id })} onFitViewport={() => workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })} />
          <div key={`${selectedReference?.id ?? selected?.id}-${documentMode}-${focusRequest}`} className="min-h-0 min-w-0 overflow-y-auto" aria-label={selectedReference ? '选中引用关系详情' : '选中行动节点详情'}>
            {selectedReference ? <ActionReferenceDetail reference={selectedReference} actions={actions} users={users} onSelectNode={selectNode} />
              : selected ? <><ActionSources node={selected} actions={actions} onSelect={selectNode} /><ActionDetail node={selected} actions={actions} users={users} author={users.find((user) => user.id === selected.authorId)} isMain={mainPath.some((node) => node.id === selected.id)} recordMode={documentMode} onModeChange={setDocumentMode} branches={actions.filter((node) => node.parentId === selected.id)} onOpenArchive={() => onOpenActionArchive(selected)} onContinue={() => onContinueAction(selected, 'continue')} onFork={() => onContinueAction(selected, 'fork')} onSelect={selectNode} /></>
                : <p className="p-6 text-sm text-muted">暂无事实</p>}
          </div>
        </div>}
      </TabsContent>
      {canEditProject && <TabsContent value="settings"><ProjectSettingsPanel id="project-settings" project={project} onSave={(patch) => onUpdateProject(project.id, patch)} /></TabsContent>}
    </TabsRoot>
  </section>
}

function EmptyActions({ onCreate }: { onCreate: () => void }) { return <div className="mt-[30px] border-y border-line py-14 text-center"><Sparkles size={24} className="mx-auto text-signal" /><h3 className="mt-3 text-[17px]">还没有行动记录</h3><button className="primary-button mt-5" type="button" onClick={onCreate}><Plus size={15} />记录第一次行动</button></div> }
