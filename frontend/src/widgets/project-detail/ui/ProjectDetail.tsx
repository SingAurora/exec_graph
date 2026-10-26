import { ArrowUpDown, Footprints, MessageCircle, Plus, ScrollText, Search, Settings2, Sparkles } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionDocumentMode, ActionNode, BranchMode } from '../../../entities/action/model/types'
import { getAncestors } from '../../../entities/action/lib/graph'
import { getActionExpression, getActionExpressionNodes, sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import { ActionGraph } from '../../action-graph/ui/ActionGraph'
import { ActionDetail } from '../../action-detail/ui/ActionDetail'
import { ActionReadingPane } from '../../action-detail/ui/ActionReadingPane'
import { ActionReferenceDetail } from '../../action-reference/ui/ActionReferenceDetail'
import type { Project } from '../../../entities/project/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ProjectSettingsPanel } from '../../../features/project/ui/ProjectSettingsPanel'
import { DeleteProject } from '../../../features/project/ui/DeleteProject'
import { getProjectDeletionDisabledReason, isProjectParticipant } from '../../../entities/project/lib/permissions'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { ProjectHeader } from '../../../entities/project/ui/ProjectHeader'
import { GraphDetailsAside } from '../../graph-details/ui/GraphDetailsAside'
import { GraphSearch } from '../../graph-search/ui/GraphSearch'
import { FollowButton } from '../../../features/follow/ui/FollowButton'
import type { GraphBackgroundPreferences } from '../../../shared/ui/graph-background/model'

/** 图详情接收业务数据及应用层回调；界面不直接发请求或导入演示数据。 */
export type ProjectDetailProps = {
  project: Project
  active?: boolean
  externalFocus?: { requestId: string } & ({ nodeId: string; mode: ActionDocumentMode } | { referenceId: string })
  currentUserId: string
  users: UserProfile[]
  actions: ActionNode[]
  showActionGraphLegend: boolean
  graphBackground: GraphBackgroundPreferences
  onCreateAction: (projectId: string) => void
  onContinueAction: (node: ActionNode, mode: BranchMode) => void
  onOpenActionArchive: (node: ActionNode) => void
  onUpdateProject: (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => void | Promise<void>
  onEditExpression: (node: ActionNode) => void
  onUpdateAgreement: (nodeId: string, markdown: string) => boolean | Promise<boolean>
  onDeleteProject: (projectId: string, expectedNodeCount: number) => boolean | Promise<boolean>
  following: boolean
  onSetGraphFollow: (projectId: string, following: boolean) => boolean | Promise<boolean>
}

type GraphSelection = { kind: 'node' | 'reference'; id: string }
type ProjectTab = 'expressions' | 'agreements' | 'facts' | 'explore' | 'search' | 'settings'

/** 图详情协调中心：装配表达、约定、行动和探索，管理选择、定位及各栏目阅读状态。 */
export function ProjectDetail({ project, active = true, externalFocus, currentUserId, users, actions, showActionGraphLegend, graphBackground, onCreateAction, onContinueAction, onOpenActionArchive, onUpdateProject, onEditExpression, onUpdateAgreement, onDeleteProject, following, onSetGraphFollow }: ProjectDetailProps) {
  const handledExternalFocus = useRef<string | undefined>(undefined)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const tabScroll = useRef<Partial<Record<ProjectTab, number>>>({})
  const pendingLocate = useRef(false)
  const lastTab = useRef<ProjectTab>('expressions')
  const wasActive = useRef(active)
  const leavingPage = useRef(false)
  const [activeTab, setActiveTab] = useState<ProjectTab>('expressions')
  const [visitedExplore, setVisitedExplore] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [nodeLocateRequest, setNodeLocateRequest] = useState(0)
  const [detailsVisible, setDetailsVisible] = useState(true)
  const [documentMode, setDocumentMode] = useState<ActionDocumentMode>('objective')
  // 表达展示路线终点的有效看法，行动展示全部记录，约定展示真实引用回应；三者不是同一列表。
  const endpoints = useMemo(() => getActionExpressionNodes(actions), [actions])
  const expressionNodes = useMemo(() => getPublishedExpressions(actions), [actions])
  const facts = useMemo(() => sortActionsNewestFirst(actions), [actions])
  const [highlightTipId, setHighlightTipId] = useState<string>()
  const defaultNode = endpoints[0] ?? facts[0]
  const highlightedPath = useMemo(() => highlightTipId ? getAncestors(actions, highlightTipId) : [], [actions, highlightTipId])
  const references = useMemo(() => getActionReferences(actions), [actions])
  const participantIds = [...new Set(actions.map((action) => action.authorId))]
  const contributorIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const action of actions) counts.set(action.authorId, (counts.get(action.authorId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
  }, [actions])
  const canEditProject = project.ownerId === currentUserId || contributorIds.includes(currentUserId)
  const isParticipant = isProjectParticipant(project, currentUserId, actions)
  const deletionDisabledReason = getProjectDeletionDisabledReason(project, currentUserId, actions)
  const canAccessSettings = canEditProject || isParticipant
  // 当前选择可以是节点或箭头；它和高亮路线终点分离，浏览其他节点不会改变高亮主链。
  const [selection, setSelection] = useState<GraphSelection>()
  const selectedReference = selection?.kind === 'reference' ? references.find((reference) => reference.id === selection.id) : undefined
  const selected = selectedReference ? undefined : actions.find((node) => selection?.kind === 'node' && node.id === selection.id) ?? defaultNode
  const visibleDocumentMode = selected && getActionExpression(actions, selected.id).markdown.trim() ? documentMode : 'objective'
  const selectNode = (id: string) => {
    if (selected?.id !== id) setDocumentMode('objective')
    setSelection({ kind: 'node', id })
    setDetailsVisible(true)
  }
  const hideDetails = () => {
    workspaceRef.current?.focus({ preventScroll: true })
    setDetailsVisible(false)
  }

  const switchTab = (tab: ProjectTab) => {
    if (tab === activeTab) return
    tabScroll.current[activeTab] = window.scrollY
    if (tab === 'explore') setVisitedExplore(true)
    setActiveTab(tab)
  }
  useLayoutEffect(() => {
    if (!active) {
      if (wasActive.current && !leavingPage.current) tabScroll.current[activeTab] = window.scrollY
      wasActive.current = false
      return
    }
    const returning = !wasActive.current
    wasActive.current = true
    leavingPage.current = false
    if (lastTab.current === activeTab && !returning) return
    lastTab.current = activeTab
    const locate = pendingLocate.current && activeTab === 'explore'
    pendingLocate.current = false
    // 等 Tab 面板完成显隐后再定位；离开时取消动画帧，避免隐藏页面的回调抢走滚动位置。
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
    setDetailsVisible(true)
    setHighlightTipId(node.id)
    setSelection({ kind: 'node', id: node.id })
    setDocumentMode(mode)
    setFocusRequest((value) => value + 1)
    pendingLocate.current = true
    switchTab('explore')
  }
  // 约定条目定位的是具体引用箭头，两端人物、约定和核对结果在右侧一起展示。
  const openReferenceInExplore = (reference: ActionReference) => {
    setDetailsVisible(true)
    setHighlightTipId(undefined)
    setSelection({ kind: 'reference', id: reference.id })
    setFocusRequest((value) => value + 1)
    pendingLocate.current = true
    switchTab('explore')
  }
  const rememberPagePosition = () => {
    tabScroll.current[activeTab] = window.scrollY
    leavingPage.current = true
  }
  useLayoutEffect(() => {
    // 消费 URL 深链接传来的单次定位请求；普通重新渲染不能反复打断用户当前阅读。
    if (!active || !externalFocus || externalFocus.requestId === handledExternalFocus.current) return
    const reference = 'referenceId' in externalFocus ? references.find((item) => item.id === externalFocus.referenceId) : undefined
    const node = 'nodeId' in externalFocus ? actions.find((item) => item.id === externalFocus.nodeId) : undefined
    if (!reference && !node) return
    handledExternalFocus.current = externalFocus.requestId
    setDetailsVisible(true)
    setHighlightTipId(reference ? undefined : node?.id)
    if (reference) setSelection({ kind: 'reference', id: reference.id })
    else if (node) setSelection({ kind: 'node', id: node.id })
    if ('mode' in externalFocus) setDocumentMode(externalFocus.mode)
    setVisitedExplore(true)
    setFocusRequest((value) => value + 1)
    pendingLocate.current = true
    setActiveTab('explore')
    const frame = window.requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }))
    return () => window.cancelAnimationFrame(frame)
  }, [active, externalFocus, actions, references])
  const createAction = () => {
    rememberPagePosition()
    onCreateAction(project.id)
  }
  const continueAction = (node: ActionNode) => {
    rememberPagePosition()
    onContinueAction(node, 'continue')
  }
  const openArchive = (node: ActionNode) => {
    rememberPagePosition()
    onOpenActionArchive(node)
  }
  const editExpression = (node: ActionNode) => {
    rememberPagePosition()
    setDocumentMode('expression')
    onEditExpression(node)
  }

  return (
    <section className="max-w-[1000px] pt-0 max-[700px]:pt-7" onClickCapture={(event) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (link?.getAttribute('href')?.startsWith('#profile?')) {
        rememberPagePosition()
      }
    }}>
      <ProjectHeader project={project} participantCount={participantIds.length} expressionCount={expressionNodes.length} actions={<div className="flex items-center gap-2">
        <FollowButton kind="graph" name={project.title} following={following} disabledReason={!actions.length ? '发布第一次行动后才能关注此图' : undefined} onChange={(next) => onSetGraphFollow(project.id, next)} />
        {!actions.length && <button className="primary-button" type="button" onClick={createAction}><Plus size={16} />记录第一次行动</button>}
      </div>} />
      <TabsRoot value={activeTab} onValueChange={(value) => switchTab(value as ProjectTab)}>
        <TabsList sticky showDivider={false}>
          <TabsTrigger value="expressions"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
          <TabsTrigger value="agreements"><span className="inline-flex items-center gap-1.5"><ScrollText size={16} />约定</span></TabsTrigger>
          <TabsTrigger value="facts"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
          <TabsTrigger value="explore"><span className="inline-flex items-center gap-1.5"><Sparkles size={16} />探索</span></TabsTrigger>
          <TabsTrigger value="search" disabled={!actions.length}><span className="inline-flex items-center gap-1.5"><Search size={16} />搜索</span></TabsTrigger>
          {canAccessSettings && <TabsTrigger value="settings"><span className="inline-flex items-center gap-1.5"><Settings2 size={16} />设置</span></TabsTrigger>}
        </TabsList>
        {(['expressions', 'facts'] as const).map((tab) => <TabsContent key={tab} value={tab} keepMounted>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
            <ActionPostList nodes={tab === 'expressions' ? expressionNodes : facts} actions={actions} users={users} mode={tab === 'expressions' ? 'expression' : 'objective'} infinite active={active && activeTab === tab} onExplore={openInExplore} />
            <GraphDetailsAside description={project.description} createdAt={project.createdAt} actionCount={actions.length} lastActionAt={facts[0]?.createdAt} participantIds={participantIds} users={users} />
          </div>
        </TabsContent>)}
        <TabsContent value="agreements" keepMounted>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
            <AgreementResponseList references={references} users={users} active={active && activeTab === 'agreements'} onExplore={openReferenceInExplore} />
            <GraphDetailsAside description={project.description} createdAt={project.createdAt} actionCount={actions.length} lastActionAt={facts[0]?.createdAt} participantIds={participantIds} users={users} />
          </div>
        </TabsContent>
        <TabsContent value="search" keepMounted>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1">
            <GraphSearch projectId={project.id} actions={actions} users={users} active={active && activeTab === 'search'} onExplore={openInExplore} onExploreReference={openReferenceInExplore} />
            <GraphDetailsAside description={project.description} createdAt={project.createdAt} actionCount={actions.length} lastActionAt={facts[0]?.createdAt} participantIds={participantIds} users={users} />
          </div>
        </TabsContent>
        <TabsContent value="explore" keepMounted={visitedExplore}>
          {!actions.length ? <p className="py-16 text-center text-[17px]">暂无节点</p> : <div className="relative mt-5">
          <div ref={workspaceRef} className={`grid h-[calc(100dvh-44px)] scroll-mt-11 overflow-hidden rounded-lg border border-line bg-surface outline-none ${detailsVisible ? 'grid-cols-[342px_minmax(0,1fr)]' : 'grid-cols-1'}`} tabIndex={-1}>
            <ActionGraph actions={actions} highlightedPath={highlightedPath} users={users} selectedId={selected?.id} selectedReferenceId={selectedReference?.id} showLegend={showActionGraphLegend} background={graphBackground} active={active && activeTab === 'explore'} focusRequest={focusRequest} locateRequest={nodeLocateRequest} detailsVisible={detailsVisible} onClearHighlight={() => setHighlightTipId(undefined)} onSelect={selectNode} onSelectReference={(id) => { setSelection({ kind: 'reference', id }); setDetailsVisible(true) }} onFitViewport={() => workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })} />
            <ActionReadingPane readingKey={selectedReference ? `reference:${selectedReference.id}` : `node:${selected?.id}:${visibleDocumentMode}`} focusRequest={focusRequest} hidden={!detailsVisible} active={active && activeTab === 'explore' && detailsVisible}>
              {selectedReference ? <ActionReferenceDetail reference={selectedReference} actions={actions} users={users} onHide={hideDetails} onSelectNode={selectNode} />
                : selected ? <ActionDetail node={selected} actions={actions} users={users} currentUserId={currentUserId} author={users.find((user) => user.id === selected.authorId)} isHighlightTip={highlightTipId === selected.id} onHighlight={() => setHighlightTipId(selected.id)} onHide={hideDetails} onLocate={() => setNodeLocateRequest((value) => value + 1)} recordMode={visibleDocumentMode} onModeChange={setDocumentMode} branches={actions.filter((node) => node.parentId === selected.id)} onOpenArchive={() => openArchive(selected)} onContinue={() => continueAction(selected)} onSelect={selectNode} onEditExpression={editExpression} onUpdateAgreement={onUpdateAgreement} />
                  : <p className="p-6 text-sm text-muted">暂无行动</p>}
            </ActionReadingPane>
          </div>
          <aside className="absolute inset-y-0 -right-7 w-6">
            <p className="sticky top-[calc(50dvh-64px)] flex w-6 flex-col items-center gap-2 rounded-full bg-soft px-1 py-3 text-xs leading-4 text-muted">
              <ArrowUpDown size={14} className="shrink-0" />
              <span className="[writing-mode:vertical-rl]">在此滚动页面</span>
            </p>
          </aside>
          </div>}
        </TabsContent>
        {canAccessSettings && <TabsContent value="settings" keepMounted><ProjectSettingsPanel id="project-settings" project={project} canEdit={canEditProject} onSave={(patch) => onUpdateProject(project.id, patch)} deletionAction={isParticipant && <DeleteProject title={project.title} nodeCount={actions.length} disabledReason={deletionDisabledReason} onDelete={(count) => onDeleteProject(project.id, count)} />} /></TabsContent>}
      </TabsRoot>
    </section>
  )
}
