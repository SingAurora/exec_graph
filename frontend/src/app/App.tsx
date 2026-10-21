import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { demoActions } from './demo/actions'
import { currentUser, initialProjects, lin, miao } from './demo/catalog'
import { cookingParticipants } from './demo/cooking/participants'
import { initialFollowing } from './demo/following'
import { deleteProjectContent } from './model/delete-project'
import { useAppNavigation } from './model/useAppNavigation'
import { actionWorkspaceHash, readActionWorkspaceRoute } from './model/action-workspace-route'
import { getActionDraftKey } from '../entities/action/lib/draft-key'
import { canFollowGraph } from '../entities/following/lib/activity'
import { FollowingPage } from '../pages/FollowingPage'
import type { ActionDocumentMode, ActionNode, ActionReferenceAgreement } from '../entities/action/model/types'
import { getActionReferences, type ActionReference } from '../entities/action/lib/references'
import { getActionContinuationContext } from '../entities/action/lib/continuation'
import { getActionExpressionContext } from '../entities/action/lib/expression-context'
import { getPublishedExpressions } from '../entities/action/lib/published'
import { getProfileAgreementResponses } from '../entities/action/lib/agreement-responses'
import { canEditActionExpression, getActionExpression, updateActionExpressionFromConversation } from '../entities/action/lib/expressions'
import { canEditActionAgreement, getActionAgreement, updateActionAgreement } from '../entities/action/lib/agreements'
import type { AIKeyConfig, SaveAIKeyInput } from '../entities/ai-key/model/types'
import { platformAIConfig } from '../entities/ai-key/model/catalog'
import type { CreateProjectInput } from '../features/project/model/types'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
import type { ChatMessage } from '../shared/model/content'
import type { Project } from '../entities/project/model/types'
import { FeedPage } from '../pages/FeedPage'
import { GraphSearchResultsPage } from '../pages/GraphSearchResultsPage'
import { ProfilePage } from '../pages/ProfilePage'
import { ProjectPage } from '../pages/ProjectPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { AuthScreen } from '../widgets/auth/AuthScreen'
import { AppShell } from '../widgets/layout/AppShell'
import { SettingsPanel } from '../widgets/settings/SettingsPanel'
import { ActionWorkspace } from '../widgets/ai/ActionWorkspace'
import { ExpressionWorkspace } from '../widgets/ai/ExpressionWorkspace'
import { ActionArchivePage } from '../pages/ActionArchivePage'

const legendPreferenceKey = 'execg.actionGraph.showLegend'

/** Composes the action-only prototype and keeps visited reading screens mounted. */
export function App() {
  const { hash, revision, route, authRoute, graphBackHash, profileBackHash, navigate } = useAppNavigation(currentUser.id)
  const query = useMemo(() => new URLSearchParams(hash.split('?')[1]), [hash])
  const [profile, setProfile] = useState(currentUser)
  const [projects, setProjects] = useState(initialProjects)
  const [actions, setActions] = useState<ActionNode[]>(demoActions)
  const [aiConfigs, setAIConfigs] = useState<AIKeyConfig[]>([platformAIConfig])
  const [followingIds, setFollowingIds] = useState<string[]>(initialFollowing.userIds)
  const [followingGraphIds, setFollowingGraphIds] = useState<string[]>(initialFollowing.graphIds)
  const [darkMode, setDarkMode] = useState(() => {
    try { return window.localStorage.getItem('exact.appearance.theme') === 'dark' }
    catch { return false }
  })
  const [graphBackground, setGraphBackground] = useGraphBackground()
  const [showActionGraphLegend, setShowActionGraphLegend] = useState(() => {
    try { return window.localStorage.getItem(legendPreferenceKey) === 'true' } catch { return false }
  })
  const [lastProjectId, setLastProjectId] = useState(query.get('projectId') ?? 'cooking')
  const workspaceRoute = route === 'publish' ? readActionWorkspaceRoute(query) : undefined
  const workspaceMode = workspaceRoute?.mode ?? 'action'
  const workspaceProjectId = workspaceRoute?.projectId
  const workspaceParentId = workspaceRoute?.mode === 'action' ? workspaceRoute.parentId : undefined
  const workspaceActionId = workspaceRoute?.mode === 'expression' ? workspaceRoute.nodeId : undefined
  const [archiveActionId, setArchiveActionId] = useState<string>()
  const selectedProjectId = route === 'project' ? query.get('projectId') ?? lastProjectId : lastProjectId
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedProjectActions = useMemo(() => actions.filter((action) => action.projectId === selectedProjectId), [actions, selectedProjectId])
  const workspaceParent = actions.find((node) => node.id === workspaceParentId && node.projectId === workspaceProjectId)
  const expressionAction = actions.find((node) => node.id === workspaceActionId && node.projectId === workspaceProjectId)
  const workspaceProject = projects.find((project) => project.id === workspaceProjectId)
  const archiveAction = actions.find((action) => action.id === archiveActionId)
  const allUsers = useMemo(() => [profile, lin, miao, ...cookingParticipants], [profile])
  const profileStats = useMemo(() => ({
    actions: actions.filter((node) => node.authorId === profile.id).length,
    expressions: getPublishedExpressions(actions, [profile.id]).length,
    agreements: getProfileAgreementResponses(getActionReferences(actions), profile.id).length,
  }), [actions, profile.id])
  // Undo may outlive its original button; always validate against the latest resources.
  const followTargets = useRef({ projects, actions, users: allUsers, selfId: profile.id })
  useLayoutEffect(() => {
    followTargets.current = { projects, actions, users: allUsers, selfId: profile.id }
  }, [projects, actions, allUsers, profile.id])
  const activeAIConfig = aiConfigs.find((config) => config.isDefault) ?? aiConfigs[0]
  const externalFocus = useMemo(() => {
    if (route !== 'project') return undefined
    const requestId = hash + ':' + revision
    const referenceId = query.get('referenceId')
    if (referenceId) return { requestId, referenceId }
    const nodeId = query.get('nodeId')
    return nodeId ? { requestId, nodeId, mode: query.get('document') === 'expression' ? 'expression' as const : 'objective' as const } : undefined
  }, [hash, query, route, revision])

  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try { window.localStorage.setItem('exact.appearance.theme', darkMode ? 'dark' : 'light') }
    catch { /* Theme changes still apply when browser storage is unavailable. */ }
  }, [darkMode])
  useEffect(() => {
    try { window.localStorage.setItem(legendPreferenceKey, String(showActionGraphLegend)) } catch { /* Storage may be unavailable. */ }
  }, [showActionGraphLegend])
  useEffect(() => {
    if (route === 'project' && query.get('projectId')) setLastProjectId(query.get('projectId')!)
  }, [route, query])

  const openProject = (projectId: string) => {
    setLastProjectId(projectId)
    navigate('project?projectId=' + encodeURIComponent(projectId))
  }
  const openGraphSearch = (keyword: string, page = 1) => navigate('graph-search?' + new URLSearchParams({ query: keyword.trim(), page: String(page) }).toString())
  const openNode = (node: ActionNode, mode: ActionDocumentMode) => {
    setLastProjectId(node.projectId)
    navigate('project?projectId=' + encodeURIComponent(node.projectId) + '&nodeId=' + encodeURIComponent(node.id) + '&document=' + mode)
  }
  const openReference = (reference: ActionReference) => {
    setLastProjectId(reference.target.projectId)
    navigate('project?projectId=' + encodeURIComponent(reference.target.projectId) + '&referenceId=' + encodeURIComponent(reference.id))
  }
  const startAction = (projectId: string, parent?: ActionNode) => {
    const nodes = actions.filter((node) => node.projectId === projectId)
    if (!projects.some((project) => project.id === projectId) || (parent ? !nodes.some((node) => node.id === parent.id) : nodes.length > 0)) return
    setLastProjectId(projectId)
    navigate(actionWorkspaceHash({ mode: 'action', projectId, parentId: parent?.id }))
  }
  const createProject = (input: CreateProjectInput) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    setProjects((current) => [{ id, ownerId: profile.id, participantIds: [], title: input.title.trim(), description: input.description.trim(), createdAt: now, updatedAt: now }, ...current])
    openProject(id)
  }
  const startExpression = (node: ActionNode) => {
    if (!canEditActionExpression(actions, node.id)) return
    navigate(actionWorkspaceHash({ mode: 'expression', projectId: node.projectId, nodeId: node.id }))
  }
  const confirmExpression = (markdown: string, conversation: ChatMessage[]) => {
    if (!workspaceActionId || !workspaceProjectId) return false
    const updated = updateActionExpressionFromConversation(actions, workspaceActionId, markdown, { authorId: profile.id, createdAt: new Date().toISOString() }, conversation)
    if (updated === actions) return false
    setActions(updated)
    openProject(workspaceProjectId)
    return true
  }
  const updateAgreement = (nodeId: string, markdown: string) => {
    if (!canEditActionAgreement(actions, nodeId) || getActionAgreement(actions, nodeId).markdown.trim() === markdown.trim()) return false
    setActions((current) => updateActionAgreement(current, nodeId, markdown, { authorId: profile.id, createdAt: new Date().toISOString() }))
    return true
  }
  const updateProject = (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => {
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project))
  }
  const deleteProject = (projectId: string, expectedNodeCount: number) => {
    const remaining = deleteProjectContent({ projects, actions, topics: [], plans: [], completions: [], reactions: {} }, projectId, profile.id, expectedNodeCount)
    if (!remaining) return false
    setProjects(remaining.projects)
    setActions(remaining.actions)
    setFollowingGraphIds((current) => current.filter((id) => id !== projectId))
    setLastProjectId('')
    setArchiveActionId(undefined)
    navigate('projects')
    return true
  }
  const saveAIConfig = (input: SaveAIKeyInput) => setAIConfigs((current) => [...current, { ...input, source: 'personal', id: crypto.randomUUID(), createdAt: new Date().toISOString(), isDefault: current.length === 0 }])
  const setDefaultAIConfig = (id: string) => setAIConfigs((current) => current.some((config) => config.id === id) ? current.map((config) => ({ ...config, isDefault: config.id === id })) : current)
  const deleteAIConfig = (id: string) => setAIConfigs((current) => { const remaining = current.filter((config) => config.id !== id || config.source === 'platform'); if (remaining.length && !remaining.some((config) => config.isDefault)) remaining[0] = { ...remaining[0], isDefault: true }; return remaining })
  const confirmAction = (markdown: string, details: { title: string }, conversation: ChatMessage[], expressionMarkdown?: string, agreementMarkdown?: string, referenceAgreements?: ActionReferenceAgreement[], mergedParentIds: string[] = []) => {
    if (!workspaceProject || (workspaceParentId && !workspaceParent)) return false
    const nodes = actions.filter((node) => node.projectId === workspaceProject.id)
    if (workspaceParent ? !nodes.some((node) => node.id === workspaceParent.id) : nodes.length > 0) return false
    const context = workspaceParent ? getActionContinuationContext(nodes, workspaceParent.id, mergedParentIds) : undefined
    if (workspaceParent ? !context : mergedParentIds.length > 0) return false
    const action: ActionNode = {
      id: crypto.randomUUID(), projectId: workspaceProject.id, number: Math.max(0, ...nodes.map((node) => node.number)) + 1,
      parentId: workspaceParent?.id, mergedParentIds, authorId: profile.id, title: details.title || '一次行动记录',
      markdown, objectiveMarkdown: markdown, expressionMarkdown, agreementMarkdown, referenceAgreements,
      contextSnapshot: { directNodeIds: context?.sources.map(({ node }) => node.id) ?? [], historyNodeCount: context?.facts.length ?? 0, guide: workspaceProject.contextGuide },
      images: [], conversation, createdAt: new Date().toISOString(),
    }
    setActions((current) => [action, ...current])
    openNode(action, 'objective')
    return true
  }
  const setUserFollow = (id: string, following: boolean) => {
    if (id === followTargets.current.selfId || !followTargets.current.users.some((user) => user.id === id)) return false
    setFollowingIds((current) => following ? current.includes(id) ? current : [...current, id] : current.filter((item) => item !== id))
    return true
  }
  const setGraphFollow = (id: string, following: boolean) => {
    if (following && !canFollowGraph(id, followTargets.current.projects, followTargets.current.actions)) return false
    setFollowingGraphIds((current) => following ? current.includes(id) ? current : [...current, id] : current.filter((item) => item !== id))
    return true
  }
  const profileReturnGraph = route === 'profile' ? query.get('fromGraph') : null
  const profileReturn = profileReturnGraph ? () => openProject(profileReturnGraph) : () => navigate(profileBackHash)
  const viewingOwnProfile = route === 'profile' && query.get('userId') === profile.id
  const personalAreaActive = route === 'my' || route === 'profile'

  if (authRoute) return <AuthScreen key={authRoute} view={authRoute} darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} onEnter={() => navigate('my')} />
  return <AppShell profile={profile} profileStats={profileStats} activeView={viewingOwnProfile ? 'my' : route} darkMode={darkMode} projectTitle={selectedProject?.title} publishTitle={workspaceMode === 'expression' ? '整理表达' : undefined}
    backAction={route === 'graph-search' ? { label: '返回发现', onBack: () => navigate('home') } : route === 'projects' ? { label: '返回我的', onBack: () => navigate('my') } : route === 'project' ? { label: '返回列表', onBack: () => navigate(graphBackHash) } : route === 'profile' && (!viewingOwnProfile || profileBackHash !== 'my') ? { label: profileReturnGraph ? '返回行动图' : '返回', onBack: profileReturn } : undefined}
    onToggleTheme={() => setDarkMode((current) => !current)} onLogout={() => navigate('login')}>
    <div hidden={!personalAreaActive}><ProfilePage users={allUsers} projects={projects} actions={actions} currentUserId={profile.id} followingIds={followingIds} active={personalAreaActive} onCreateProject={createProject} onSetUserFollow={setUserFollow} onOpenProject={openProject} onOpenNode={openNode} onOpenReference={openReference} /></div>
    <div hidden={route !== 'home'}><FeedPage actions={actions} projects={projects} users={allUsers} active={route === 'home'} onOpenProject={openProject} onOpenNode={openNode} onOpenReference={openReference} onSearchGraphs={openGraphSearch} /></div>
    {route === 'graph-search' && <GraphSearchResultsPage params={query} projects={projects} actions={actions} onOpenProject={openProject} onSearch={openGraphSearch} onPageChange={(page) => openGraphSearch(query.get('query') ?? '', page)} />}
    <div hidden={route !== 'following'}><FollowingPage actions={actions} projects={projects} users={allUsers} sources={{ userIds: followingIds, graphIds: followingGraphIds }} active={route === 'following'} onOpenProject={openProject} onOpenNode={openNode} onOpenReference={openReference} onSetGraphFollow={setGraphFollow} onSetUserFollow={setUserFollow} /></div>
    <div hidden={route !== 'projects'}><ProjectsPage currentUserId={profile.id} projects={projects} actions={actions} onCreateProject={createProject} onOpenProject={openProject} /></div>
    {selectedProject && <div hidden={route !== 'project'}><ProjectPage key={selectedProject.id} active={route === 'project'} project={selectedProject} externalFocus={externalFocus} currentUserId={profile.id} users={allUsers} actions={selectedProjectActions} showActionGraphLegend={showActionGraphLegend} graphBackground={graphBackground}
      onCreateAction={startAction} onContinueAction={(node) => startAction(selectedProject.id, node)}
      onOpenActionArchive={(node) => { setLastProjectId(node.projectId); setArchiveActionId(node.id); navigate('action-archive') }}
      onUpdateProject={updateProject} onEditExpression={startExpression} onUpdateAgreement={updateAgreement} onDeleteProject={deleteProject} following={followingGraphIds.includes(selectedProject.id)} onSetGraphFollow={setGraphFollow} /></div>}
    {route === 'publish' && (workspaceMode === 'expression' && expressionAction ? <ExpressionWorkspace key={profile.id + ':expression-' + expressionAction.id} node={expressionAction} actions={actions.filter((node) => node.projectId === expressionAction.projectId)}
      profileName={profile.name} profileId={profile.id} profile={profile} users={allUsers} aiConfig={activeAIConfig} contextGuide={workspaceProject?.contextGuide} onBack={() => openProject(expressionAction.projectId)} onConfirm={confirmExpression} />
      : workspaceMode === 'action' && workspaceProject && (!workspaceParentId || workspaceParent) && (workspaceParent || !actions.some((node) => node.projectId === workspaceProject.id)) ? <ActionWorkspace key={getActionDraftKey(profile.id, workspaceProject.id, 'action', workspaceParentId)} draftKey={getActionDraftKey(profile.id, workspaceProject.id, 'action', workspaceParentId)} profileName={profile.name} profile={profile} aiConfig={activeAIConfig} hasParent={Boolean(workspaceParent)}
        contextTitle={workspaceParent?.title} sourceNodeId={workspaceParent?.id} sourceNodeNumber={workspaceParent?.number} actions={actions.filter((node) => node.projectId === workspaceProject.id)}
        expressionSourceNumber={workspaceParent ? getActionExpression(actions, workspaceParent.id).sourceNode?.number : undefined}
        inheritedExpression={workspaceParent ? getActionExpression(actions, workspaceParent.id).markdown : ''}
        inheritedExpressionImages={workspaceParent ? getActionExpression(actions, workspaceParent.id).sourceNode?.images : []}
        historyFacts={workspaceParent ? getActionExpressionContext(actions, workspaceParent.id)?.facts : []}
        inheritedAgreement={workspaceParent ? getActionAgreement(actions, workspaceParent.id).markdown : ''} contextGuide={workspaceProject.contextGuide}
        onBack={() => openProject(workspaceProject.id)} onConfirm={confirmAction} />
      : <div className="empty-state"><p>请先选择行动图和接续节点</p><a className="quiet-button" href="#projects">浏览行动图</a></div>)}
    {route === 'action-archive' && (archiveAction && selectedProject ? <ActionArchivePage project={selectedProject} node={archiveAction} actions={selectedProjectActions} users={allUsers} onBack={() => openProject(selectedProject.id)} onSelectSource={(id) => { setArchiveActionId(id); window.scrollTo(0, 0) }} /> : <div className="empty-state"><p>请从行动节点查看形成过程</p><a className="quiet-button" href="#projects">浏览行动图</a></div>)}
    {route === 'project' && !selectedProject && <div className="empty-state"><p>行动图不存在或已删除</p><a className="quiet-button" href="#projects">浏览行动图</a></div>}
    <div hidden={route !== 'settings'}><SettingsPanel profile={profile} darkMode={darkMode} showActionGraphLegend={showActionGraphLegend} graphBackground={graphBackground} onGraphBackgroundChange={setGraphBackground} aiConfigs={aiConfigs} onSave={setProfile} onToggleTheme={() => setDarkMode((current) => !current)} onShowActionGraphLegendChange={setShowActionGraphLegend} onSaveAIConfig={saveAIConfig} onSetDefaultAIConfig={setDefaultAIConfig} onDeleteAIConfig={deleteAIConfig} /></div>
  </AppShell>
}
