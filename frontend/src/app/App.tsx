import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppResources } from './model/useAppResources'
import { useAppCommands } from './model/useAppCommands'
import { useAppearance } from './model/useAppearance'
import { isAuthView, useHashRoute } from '../shared/lib/navigation'
import { profileKeys, type SessionView } from '../entities/profile/api/profiles'
import { logout } from '../features/auth/api/account'
import { useToast } from '../shared/ui/toast/useToast'
import { useImageAssets } from '../features/media-upload/model/useImageAssets'
import { resourceId } from '../shared/lib/resource-id'
import { useAppNavigation } from './model/useAppNavigation'
import { actionWorkspaceHash, readActionWorkspaceRoute } from './model/action-workspace-route'
import { getActionDraftKey } from '../entities/action/lib/draft-key'
import type { FollowedSources } from '../entities/following/model/types'
import type { GraphView } from '../entities/project/api/graphs'
import type { AccountProfile } from '../entities/profile/api/profiles'
import type { VersionedAction } from '../entities/action/api/context'
import type { UserProfile } from '../entities/profile/model/types'
import { documentUpdate, type CreateActionInput } from '../features/action/api/commands'
import type { GenerationView } from '../features/action-generation/api/generation'
import { FollowingPage } from '../pages/FollowingPage'
import type { ActionDocumentMode, ActionNode } from '../entities/action/model/types'
import { getActionReferences, type ActionReference } from '../entities/action/lib/references'
import { getActionExpressionContext } from '../entities/action/lib/expression-context'
import { getPublishedExpressions } from '../entities/action/lib/published'
import { getProfileAgreementResponses } from '../entities/action/lib/agreement-responses'
import { canEditActionExpression, getActionExpression } from '../entities/action/lib/expressions'
import { getActionAgreement } from '../entities/action/lib/agreements'
import type { CreateProjectInput } from '../features/project/model/types'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
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

/** 应用的数据入口：先加载业务资料，再挂载页面；加载失败展示重试入口，不回退演示数据。 */
export function App() {
  const resources = useAppResources()
  const client = useQueryClient()
  const [darkMode, toggleTheme] = useAppearance()
  const [authView] = useHashRoute('login', isAuthView)
  const { showToast } = useToast()
  const enter = async (session: SessionView) => {
    await client.cancelQueries()
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    client.setQueryData(profileKeys.session, session)
    if (isAuthView(window.location.hash.slice(1).split('?')[0])) window.location.hash = 'my'
  }
  const exit = async () => {
    if (!resources.csrfToken) return
    try {
      await logout(resources.csrfToken)
      await client.cancelQueries()
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      client.setQueryData(profileKeys.session, null)
      window.location.hash = 'login'
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '退出失败，请重试' }) }
  }
  if (resources.anonymous) return <AuthScreen key={authView} view={authView} darkMode={darkMode} onToggleTheme={toggleTheme} onEnter={enter} />
  if (
    !resources.ready ||
    !resources.profile ||
    !resources.projects ||
    !resources.actions ||
    !resources.sources ||
    !resources.csrfToken
  ) {
    return (
      <main
        className="grid min-h-dvh place-content-center gap-4 bg-paper p-8 text-center text-sm text-copy"
        role="status"
      >
        <p>{resources.error?.message ?? '正在加载…'}</p>
        {resources.error && (
          <button className="quiet-button" type="button" onClick={resources.retry}>
            重试
          </button>
        )}
      </main>
    )
  }

  return (
    <>
      <AppContent
        key={resources.profile.id}
        darkMode={darkMode} toggleTheme={toggleTheme} onLogout={exit}
        profile={resources.profile}
        projects={resources.projects}
        actions={resources.actions}
        allUsers={resources.allUsers}
        sources={resources.sources}
        csrfToken={resources.csrfToken}
      />
      {resources.error && (
        <div
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-copy"
          role="status"
        >
          <span>{resources.error.message}</span>
          <button className="text-button" type="button" onClick={resources.retry}>
            重试
          </button>
        </div>
      )}
    </>
  )
}

/** 应用装配层：把 Query 中的业务数据、路由和写入回调连接到页面及工作区。 */
function AppContent({ profile, projects, actions, allUsers, sources, csrfToken, darkMode, toggleTheme, onLogout }: {
  profile: AccountProfile; projects: GraphView[]; actions: VersionedAction[]; allUsers: UserProfile[]; sources: FollowedSources; csrfToken: string
  darkMode: boolean; toggleTheme: () => void; onLogout: () => Promise<void>
}) {
  const commands = useAppCommands(profile.id, csrfToken)
  const imageAsset = useImageAssets(csrfToken)
  const { hash, revision, route, graphBackHash, profileBackHash, navigate } = useAppNavigation(profile.id)
  // useMemo 缓存从现有数据计算出的结果；这里仅在 hash 改变时重新解析路由参数。
  const query = useMemo(() => {
    const params = new URLSearchParams(hash.split('?')[1])
    for (const name of ['projectId', 'fromGraph']) {
      const id = resourceId(projects, params.get(name)); if (id) params.set(name, id)
    }
    for (const name of ['nodeId', 'parentId']) {
      const id = resourceId(actions, params.get(name)); if (id) params.set(name, id)
    }
    const userId = resourceId(allUsers, params.get('userId')); if (userId) params.set('userId', userId)
    const reference = params.get('referenceId')?.split(':')
    if (reference?.length === 2) params.set('referenceId', reference.map((id) => resourceId(actions, id)).join(':'))
    return params
  }, [hash, projects, actions, allUsers])
  // useState 保存客户端交互状态；业务资料由传入的 Query 数据提供。
  const followingIds = sources.userIds, followingGraphIds = sources.graphIds
  const [graphBackground, setGraphBackground] = useGraphBackground()
  const [showActionGraphLegend, setShowActionGraphLegend] = useState(() => {
    try { return window.localStorage.getItem(legendPreferenceKey) === 'true' } catch { return false }
  })
  // 离开图进入编辑器或形成过程时，仍保留最近一张图，供返回后恢复阅读。
  const [lastProjectId, setLastProjectId] = useState(query.get('projectId') ?? resourceId(projects, 'cooking') ?? projects[0]?.id ?? '')
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
  // 表达数按路线终点计算；约定数按已满足的跨用户引用计算，都不是简单数 Markdown 字段。
  const profileStats = useMemo(() => ({
    actions: actions.filter((node) => node.authorId === profile.id).length,
    expressions: getPublishedExpressions(actions, [profile.id]).length,
    agreements: getProfileAgreementResponses(getActionReferences(actions), profile.id).length,
  }), [actions, profile.id])
  // 列表的深链接转成图内定位请求；revision 让重复进入同一地址也能重新定位。
  const externalFocus = useMemo(() => {
    if (route !== 'project') {
      return undefined
    }
    const requestId = hash + ':' + revision
    const referenceId = query.get('referenceId')
    if (referenceId) {
      return { requestId, referenceId }
    }
    const nodeId = query.get('nodeId')
    return nodeId ? { requestId, nodeId, mode: query.get('document') === 'expression' ? 'expression' as const : 'objective' as const } : undefined
  }, [hash, query, route, revision])

  useEffect(() => {
    try { window.localStorage.setItem(legendPreferenceKey, String(showActionGraphLegend)) } catch { /* 存储失败不阻止本次显示图例。 */ }
  }, [showActionGraphLegend])
  useEffect(() => {
    if (route === 'project' && query.get('projectId')) {
      setLastProjectId(query.get('projectId')!)
    }
  }, [route, query])

  // 这些导航函数只描述目标地址；节点、文档和引用的实际选中状态由图详情组件接手。
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
    if (!projects.some((project) => project.id === projectId) || (parent ? !nodes.some((node) => node.id === parent.id) : nodes.length > 0)) {
      return
    }
    setLastProjectId(projectId)
    navigate(actionWorkspaceHash({ mode: 'action', projectId, parentId: parent?.id }))
  }
  const createProject = async (input: CreateProjectInput) => {
    const graph = await commands.graphCreate.mutateAsync(input)
    openProject(graph.id)
  }
  const startExpression = (node: ActionNode) => {
    if (!canEditActionExpression(actions, node.id)) {
      return
    }
    navigate(actionWorkspaceHash({ mode: 'expression', projectId: node.projectId, nodeId: node.id }))
  }
  // mutateAsync 等待服务确认后才返回成功；expectedVersion 防止覆盖已被别人修改的版本。
  const confirmExpression = async (input: NonNullable<GenerationView['updateExpression']>) => {
    if (!workspaceActionId || !workspaceProjectId) {
      return false
    }
    const node = actions.find((item) => item.id === workspaceActionId)
    if (!node) {
      return false
    }
    if (input.nodeId !== node.id) return false
    await commands.expressionUpdate.mutateAsync(input)
    openProject(workspaceProjectId)
    return true
  }
  const updateAgreement = async (nodeId: string, markdown: string) => {
    const node = actions.find((item) => item.id === nodeId)
    if (!node) {
      return false
    }
    await commands.agreementUpdate.mutateAsync({ nodeId, expectedVersion: node.version, document: documentUpdate(markdown) })
    return true
  }
  const updateProject = async (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => {
    const graph = projects.find((item) => item.id === projectId)
    if (!graph) {
      throw new Error('行动图不存在')
    }
    const avatarAssetId = await imageAsset(patch.avatar, graph.avatar, graph.avatarAssetId)
    const backgroundAssetId = await imageAsset(patch.backgroundImage, graph.backgroundImage, graph.backgroundAssetId)
    await commands.graphUpdate.mutateAsync({ graphId: projectId, expectedVersion: graph.version, title: patch.title, description: patch.description, avatarAssetId, backgroundAssetId })
  }
  const deleteProject = async (projectId: string, expectedNodeCount: number) => {
    const graph = projects.find((item) => item.id === projectId)
    if (!graph) {
      return false
    }
    await commands.graphDelete.mutateAsync({ graphId: projectId, expectedVersion: graph.version, expectedNodeCount })
    setLastProjectId('')
    setArchiveActionId(undefined)
    navigate('projects')
    return true
  }
  const confirmAction = async (input: CreateActionInput) => {
    if (!workspaceProject || (workspaceParentId && !workspaceParent)) {
      return false
    }
    if (input.graphId !== workspaceProject.id || input.parentId !== workspaceParent?.id) return false
    const action = await commands.actionCreate.mutateAsync(input)
    openNode({ ...action, projectId: action.graphId }, 'objective')
    return true
  }
  const setUserFollow = async (id: string, following: boolean) => {
    await commands.followUpdate.mutateAsync({ kind: 'user', targetId: id, following })
    return true
  }
  const setGraphFollow = async (id: string, following: boolean) => {
    await commands.followUpdate.mutateAsync({ kind: 'graph', targetId: id, following })
    return true
  }
  const saveProfile = async (value: UserProfile) => {
    const avatarAssetId = await imageAsset(value.avatar, profile.avatar, profile.avatarAssetId)
    const backgroundAssetId = await imageAsset(value.backgroundImage, profile.backgroundImage, profile.backgroundAssetId)
    await commands.profileUpdate.mutateAsync({ name: value.name, bio: value.bio, gender: value.gender, avatarAssetId, backgroundAssetId, expectedVersion: profile.version })
  }
  const profileReturnGraph = route === 'profile' ? query.get('fromGraph') : null
  const profileReturn = profileReturnGraph ? () => openProject(profileReturnGraph) : () => navigate(profileBackHash)
  const viewingOwnProfile = route === 'profile' && query.get('userId') === profile.id
  const personalAreaActive = route === 'my' || route === 'profile'

  return (
    <AppShell
      profile={profile}
      profileStats={profileStats}
      activeView={viewingOwnProfile ? 'my' : route}
      darkMode={darkMode}
      projectTitle={selectedProject?.title}
      publishTitle={workspaceMode === 'expression' ? '整理表达' : undefined}
      backAction={
        route === 'graph-search' ? { label: '返回发现', onBack: () => navigate('home') }
          : route === 'projects' ? { label: '返回我的', onBack: () => navigate('my') }
            : route === 'project' ? { label: '返回列表', onBack: () => navigate(graphBackHash) }
              : route === 'profile' && (!viewingOwnProfile || profileBackHash !== 'my')
                ? { label: profileReturnGraph ? '返回行动图' : '返回', onBack: profileReturn }
                : undefined
      }
      onToggleTheme={toggleTheme}
      onLogout={onLogout}
    >
      <div hidden={!personalAreaActive}>
        <ProfilePage
          users={allUsers} projects={projects} actions={actions}
          currentUserId={profile.id} followingIds={followingIds} active={personalAreaActive}
          onCreateProject={createProject} onSetUserFollow={setUserFollow}
          onOpenProject={openProject} onOpenNode={openNode} onOpenReference={openReference}
        />
      </div>
      <div hidden={route !== 'home'}>
        <FeedPage
          actions={actions} projects={projects} users={allUsers} active={route === 'home'}
          onOpenProject={openProject} onOpenNode={openNode}
          onOpenReference={openReference} onSearchGraphs={openGraphSearch}
        />
      </div>
      {route === 'graph-search' && (
        <GraphSearchResultsPage
          params={query} projects={projects} actions={actions}
          onOpenProject={openProject} onSearch={openGraphSearch}
          onPageChange={(page) => openGraphSearch(query.get('query') ?? '', page)}
        />
      )}
      <div hidden={route !== 'following'}>
        <FollowingPage
          actions={actions} projects={projects} users={allUsers}
          sources={{ userIds: followingIds, graphIds: followingGraphIds }} active={route === 'following'}
          onOpenProject={openProject} onOpenNode={openNode} onOpenReference={openReference}
          onSetGraphFollow={setGraphFollow} onSetUserFollow={setUserFollow}
        />
      </div>
      <div hidden={route !== 'projects'}>
        <ProjectsPage
          currentUserId={profile.id} projects={projects} actions={actions}
          onCreateProject={createProject} onOpenProject={openProject}
        />
      </div>
      {selectedProject && (
        <div hidden={route !== 'project'}>
          <ProjectPage
            key={selectedProject.id} active={route === 'project'} project={selectedProject}
            externalFocus={externalFocus} currentUserId={profile.id} users={allUsers}
            actions={selectedProjectActions} showActionGraphLegend={showActionGraphLegend}
            graphBackground={graphBackground}
            onCreateAction={startAction}
            onContinueAction={(node) => startAction(selectedProject.id, node)}
            onOpenActionArchive={(node) => {
              setLastProjectId(node.projectId)
              setArchiveActionId(node.id)
              navigate('action-archive')
            }}
            onUpdateProject={updateProject} onEditExpression={startExpression}
            onUpdateAgreement={updateAgreement} onDeleteProject={deleteProject}
            following={followingGraphIds.includes(selectedProject.id)} onSetGraphFollow={setGraphFollow}
          />
        </div>
      )}
      {route === 'publish' && (
        workspaceMode === 'expression' && expressionAction ? (
          <ExpressionWorkspace
            csrfToken={csrfToken}
            draftKey={getActionDraftKey(profile.legacyId ?? profile.id, workspaceProject?.legacyId ?? expressionAction.projectId, 'expression', expressionAction.legacyId ?? expressionAction.id)}
            key={profile.id + ':expression-' + expressionAction.id}
            node={expressionAction}
            actions={actions.filter((node) => node.projectId === expressionAction.projectId)}
            profileName={profile.name} profileId={profile.id} profile={profile} users={allUsers}
            contextGuide={workspaceProject?.contextGuide}
            onBack={() => openProject(expressionAction.projectId)} onConfirm={confirmExpression}
          />
        ) : workspaceMode === 'action' && workspaceProject && (!workspaceParentId || workspaceParent) && (workspaceParent || !actions.some((node) => node.projectId === workspaceProject.id)) ? (
          <ActionWorkspace
            graphId={workspaceProject.id} csrfToken={csrfToken}
            key={getActionDraftKey(profile.id, workspaceProject.id, 'action', workspaceParentId)}
            draftKey={getActionDraftKey(profile.legacyId ?? profile.id, workspaceProject.legacyId ?? workspaceProject.id, 'action', workspaceParent?.legacyId ?? workspaceParentId)}
            profileName={profile.name} profile={profile} hasParent={Boolean(workspaceParent)}
            contextTitle={workspaceParent?.title} sourceNodeId={workspaceParent?.id}
            sourceNodeNumber={workspaceParent?.number}
            actions={actions.filter((node) => node.projectId === workspaceProject.id)}
            expressionSourceNumber={workspaceParent ? getActionExpression(actions, workspaceParent.id).sourceNode?.number : undefined}
            inheritedExpression={workspaceParent ? getActionExpression(actions, workspaceParent.id).markdown : ''}
            inheritedExpressionImages={workspaceParent ? getActionExpression(actions, workspaceParent.id).sourceNode?.images : []}
            historyFacts={workspaceParent ? getActionExpressionContext(actions, workspaceParent.id)?.facts : []}
            inheritedAgreement={workspaceParent ? getActionAgreement(actions, workspaceParent.id).markdown : ''}
            contextGuide={workspaceProject.contextGuide}
            onBack={() => openProject(workspaceProject.id)} onConfirm={confirmAction}
          />
        ) : (
          <div className="empty-state">
            <p>请先选择行动图和接续节点</p>
            <a className="quiet-button" href="#projects">浏览行动图</a>
          </div>
        )
      )}
      {route === 'action-archive' && (
        archiveAction && selectedProject ? (
          <ActionArchivePage
            project={selectedProject} node={archiveAction} actions={selectedProjectActions} users={allUsers}
            onBack={() => openProject(selectedProject.id)}
            onSelectSource={(id) => {
              setArchiveActionId(id)
              window.scrollTo(0, 0)
            }}
          />
        ) : (
          <div className="empty-state">
            <p>请从行动节点查看形成过程</p>
            <a className="quiet-button" href="#projects">浏览行动图</a>
          </div>
        )
      )}
      {route === 'project' && !selectedProject && (
        <div className="empty-state">
          <p>行动图不存在或已删除</p>
          <a className="quiet-button" href="#projects">浏览行动图</a>
        </div>
      )}
      <div hidden={route !== 'settings'}>
        <SettingsPanel
          profile={profile} darkMode={darkMode} showActionGraphLegend={showActionGraphLegend}
          graphBackground={graphBackground} onGraphBackgroundChange={setGraphBackground}
          onSave={saveProfile} onToggleTheme={toggleTheme} csrfToken={csrfToken}
          onShowActionGraphLegendChange={setShowActionGraphLegend}
        />
      </div>
    </AppShell>
  )
}
