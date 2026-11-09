import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppResources } from './model/useAppResources'
import { useAppCommands } from './model/useAppCommands'
import { useAppearance } from './model/useAppearance'
import { isAppView, isAuthView } from '../shared/lib/navigation'
import { ListSkeleton } from '../shared/ui/ListSkeleton'
import { useImageAssets } from '../features/media-upload/model/useImageAssets'
import { useAppNavigation } from './model/useAppNavigation'
import { actionWorkspaceHash, readActionWorkspaceRoute } from './model/action-workspace-route'
import { generateNodeDocuments } from '../features/action-generation/api/generation'
import type { FollowedSources } from '../entities/following/model/types'
import type { GraphView } from '../entities/graph/api/graphs'
import type { AccountProfile } from '../entities/profile/api/profiles'
import type { VersionedAction } from '../entities/action/api/context'
import type { UserProfile } from '../entities/profile/model/types'
import type { CreateActionInput } from '../features/action/api/commands'
import type { GenerationView } from '../features/action-generation/api/generation'
import { FollowingPage } from '../pages/FollowingPage'
import type { ActionDocumentMode, ActionNode } from '../entities/action/model/types'
import { getActionReferences, type ActionReference } from '../entities/action/lib/references'
import { getPublishedExpressions } from '../entities/action/lib/published'
import { getProfileAgreementResponses } from '../entities/action/lib/agreement-responses'
import { canEditActionExpression } from '../entities/action/lib/expressions'
import { canEditActionAgreement } from '../entities/action/lib/agreements'
import type { CreateGraphInput } from '../features/graph/model/types'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
import type { Graph } from '../entities/graph/model/types'
import { FeedPage } from '../pages/FeedPage'
import { GraphSearchResultsPage } from '../pages/GraphSearchResultsPage'
import { ProfilePage } from '../pages/ProfilePage'
import { GraphPage } from '../pages/GraphPage'
import { GraphsPage } from '../pages/GraphsPage'
import { AuthScreen } from '../widgets/auth/AuthScreen'
import { GuestApp } from './GuestApp'
import { WorkspaceOutlet } from './ui/WorkspaceOutlet'
import { useAuthStore } from '../features/auth/model/auth-store'
import { NotFoundScreen } from './NotFoundScreen'
import { AppShell } from '../widgets/layout/AppShell'
import { SettingsPanel } from '../widgets/settings/SettingsPanel'
import { ActionArchivePage } from '../pages/ActionArchivePage'

const legendPreferenceKey = 'execg.actionGraph.showLegend'

/** 应用的数据入口：认证状态由 Zustand 提供，业务数据由 Query 提供。 */
export function App() {
  // ── 认证状态与业务数据 ──
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const authError = useAuthStore((state) => state.error)
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const retryAuth = useAuthStore((state) => state.retry)
  const logout = useAuthStore((state) => state.logout)
  const resources = useAppResources(user, status)
  const client = useQueryClient()
  const [darkMode, toggleTheme] = useAppearance()
  const [hash, setHash] = useState(() => window.location.hash)
  // ── 启动认证检查与 URL 同步 ──
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])
  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  // ── 账号切换时清理业务缓存 ──
  // 公开数据、游客数据和旧账号数据不能混用。
  const previousUser = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const current = user?.uuid ?? null
    if (previousUser.current === undefined) {
      previousUser.current = current
      return
    }
    if (previousUser.current === current) return
    previousUser.current = current
    void client.cancelQueries()
    client.removeQueries()
  }, [client, user?.uuid])
  // ── 路由解析 ──
  const rawView = hash.slice(1).split('?')[0]
  const loadingView = isAppView(rawView) ? rawView : 'home'
  const loadingAuth = isAuthView(rawView)
  const authView = isAuthView(rawView) ? rawView : 'login'
  const knownRoute = rawView === '' || isAppView(rawView) || isAuthView(rawView)
  // 登录成功后离开登录/注册地址，避免刷新后又回到认证页。
  useEffect(() => {
    if (status === 'signed-in' && isAuthView(rawView)) window.location.hash = 'my'
  }, [rawView, status])
  const exit = async () => {
    await logout()
    window.location.hash = 'login'
  }
  // ── 认证分支渲染 ──
  // 未知 hash 不静默回退首页。
  if (!knownRoute) return <NotFoundScreen />
  // 会话读取失败时保留错误，允许重试；不能误判成未登录。
  if (status === 'error') return (
    <main className="grid min-h-dvh place-content-center gap-4 bg-paper p-8 text-center text-sm text-copy">
      <p>{authError ?? '无法读取登录状态，请重试'}</p>
      <button className="quiet-button" type="button" onClick={() => { void retryAuth() }}>重试</button>
    </main>
  )
  // 启动检查期间还没有可信的登录状态。
  if (status === 'booting' || (status === 'signed-in' && !user)) return (
    <main className="mx-auto w-[min(1200px,calc(100%-72px))] pt-[30px] max-[1000px]:w-[min(920px,calc(100%-48px))]">
      <div className="pt-6"><ListSkeleton rows={5} /></div>
    </main>
  )
  // 未登录：认证页走 AuthScreen，其余走公开浏览。
  if (status === 'signed-out') {
    if (isAuthView(rawView)) return (
      <AuthScreen key={authView} view={authView} />
    )
    if (resources.error) return (
      <main className="grid min-h-dvh place-content-center gap-4 bg-paper p-8 text-center text-sm text-copy">
        <p>{resources.error.message}</p>
        <button className="quiet-button" type="button" onClick={resources.retry}>重试</button>
      </main>
    )
    if (!resources.ready) return (
      <main className="mx-auto w-[min(1200px,calc(100%-72px))] pt-[30px] max-[1000px]:w-[min(920px,calc(100%-48px))]">
        <div className="pt-6"><ListSkeleton rows={5} /></div>
      </main>
    )
    return (
      <GuestApp
        graphs={resources.graphs ?? []}
        actions={resources.actions ?? []}
        users={resources.allUsers}
      />
    )
  }
  // 已登录：等待图、用户、关注和行动上下文全部就绪。
  if (
    !user ||
    !resources.ready ||
    !resources.graphs ||
    !resources.actions ||
    !resources.sources
  ) {
    if (resources.error) {
      return (
        <main className="grid min-h-dvh place-content-center gap-4 bg-paper p-8 text-center text-sm text-copy">
          <p>{resources.error.message}</p>
          <button className="quiet-button" type="button" onClick={resources.retry}>
            重试
          </button>
        </main>
      )
    }
    if (loadingAuth) {
      return (
        <main className="grid min-h-dvh place-content-center bg-paper p-8">
          <ListSkeleton rows={3} className="w-[min(360px,calc(100vw-48px))]" />
        </main>
      )
    }
    return (
      <AppShell activeView={loadingView} darkMode={darkMode} loading onToggleTheme={toggleTheme}>
        <div className="pt-6"><ListSkeleton rows={5} /></div>
      </AppShell>
    )
  }

  // 认证和业务数据都就绪，挂载完整应用。
  return (
    <>
      <AppContent
        key={user.uuid}
        darkMode={darkMode} toggleTheme={toggleTheme} onLogout={exit}
        profile={user}
        graphs={resources.graphs}
        actions={resources.actions}
        allUsers={resources.allUsers}
        sources={resources.sources}
      />
      {resources.error && (
        <div
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-copy"
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
function AppContent({ profile, graphs, actions, allUsers, sources, darkMode, toggleTheme, onLogout }: {
  profile: AccountProfile; graphs: GraphView[]; actions: VersionedAction[]; allUsers: UserProfile[]; sources: FollowedSources
  darkMode: boolean; toggleTheme: () => void; onLogout: () => Promise<void>
}) {
  // ── 数据、路由和本地界面状态 ──
  const commands = useAppCommands(profile.uuid)
  const imageAsset = useImageAssets()
  const { hash, revision, route, graphBackHash, profileBackHash, navigate } = useAppNavigation(profile.uuid)
  // useMemo 缓存从现有数据计算出的结果；这里仅在 hash 改变时重新解析路由参数。
  const query = useMemo(() => new URLSearchParams(hash.split('?')[1]), [hash])
  // useState 保存客户端交互状态；业务资料由传入的 Query 数据提供。
  const followingIds = sources.userUuids, followingGraphUuids = sources.graphUuids
  const [graphBackground, setGraphBackground] = useGraphBackground()
  const [showActionGraphLegend, setShowActionGraphLegend] = useState(() => {
    try { return window.localStorage.getItem(legendPreferenceKey) === 'true' } catch { return false }
  })
  // ── 当前图、节点和工作区 ──
  // 离开图进入编辑器或形成过程时，仍保留最近一张图，供返回后恢复阅读。
  const [lastGraphUuid, setLastGraphUuid] = useState(query.get('graphUuid') ?? graphs[0]?.uuid ?? '')
  const workspaceRoute = route === 'publish' ? readActionWorkspaceRoute(query) : undefined
  const workspaceMode = workspaceRoute?.mode ?? 'action'
  const workspaceGraphUuid = workspaceRoute?.graphUuid
  const workspaceParentUuid = workspaceRoute?.mode === 'action' ? workspaceRoute.parentUuid : undefined
  const workspaceActionUuid = workspaceRoute?.mode === 'expression' || workspaceRoute?.mode === 'agreement' ? workspaceRoute.nodeUuid : undefined
  const [archiveActionId, setArchiveActionId] = useState<string>()
  const selectedGraphUuid = route === 'graph' ? query.get('graphUuid') ?? lastGraphUuid : lastGraphUuid
  const selectedGraph = graphs.find((graph) => graph.uuid === selectedGraphUuid)
  const selectedGraphActions = useMemo(() => actions.filter((action) => action.graphUuid === selectedGraphUuid), [actions, selectedGraphUuid])
  const workspaceParent = actions.find((node) => node.uuid === workspaceParentUuid && node.graphUuid === workspaceGraphUuid)
  const expressionAction = actions.find((node) => node.uuid === workspaceActionUuid && node.graphUuid === workspaceGraphUuid)
  const workspaceGraph = graphs.find((graph) => graph.uuid === workspaceGraphUuid)
  const archiveAction = actions.find((action) => action.uuid === archiveActionId)
  // ── 主页统计与深链接定位 ──
  // 表达数按路线终点计算；约定数按已满足的跨用户引用计算，都不是简单数 Markdown 字段。
  const profileStats = useMemo(() => ({
    actions: actions.filter((node) => node.authorUuid === profile.uuid).length,
    expressions: getPublishedExpressions(actions, [profile.uuid]).length,
    agreements: getProfileAgreementResponses(getActionReferences(actions), profile.uuid).length,
  }), [actions, profile.uuid])
  // 列表的深链接转成图内定位请求；revision 让重复进入同一地址也能重新定位。
  const externalFocus = useMemo(() => {
    if (route !== 'graph') {
      return undefined
    }
    const requestId = hash + ':' + revision
    const referenceUuid = query.get('referenceUuid')
    if (referenceUuid) {
      return { requestId, referenceUuid }
    }
    const nodeUuid = query.get('nodeUuid')
    return nodeUuid ? { requestId, nodeUuid, mode: query.get('document') === 'expression' ? 'expression' as const : 'objective' as const } : undefined
  }, [hash, query, route, revision])

  useEffect(() => {
    try { window.localStorage.setItem(legendPreferenceKey, String(showActionGraphLegend)) } catch { /* 存储失败不阻止本次显示图例。 */ }
  }, [showActionGraphLegend])
  useEffect(() => {
    if (route === 'graph' && query.get('graphUuid')) {
      setLastGraphUuid(query.get('graphUuid')!)
    }
  }, [route, query])

  // ── 导航函数 ──
  // 这些函数只改目标 hash；节点、文档和引用的实际选中状态由图详情组件接手。
  const openGraph = (graphUuid: string) => {
    setLastGraphUuid(graphUuid)
    navigate('graph?graphUuid=' + encodeURIComponent(graphUuid))
  }
  const openGraphSearch = (keyword: string, page = 1) => navigate('graph-search?' + new URLSearchParams({ query: keyword.trim(), page: String(page) }).toString())
  const openNode = (node: ActionNode, mode: ActionDocumentMode) => {
    setLastGraphUuid(node.graphUuid)
    navigate('graph?graphUuid=' + encodeURIComponent(node.graphUuid) + '&nodeUuid=' + encodeURIComponent(node.uuid) + '&document=' + mode)
  }
  const openReference = (reference: ActionReference) => {
    setLastGraphUuid(reference.target.graphUuid)
    navigate('graph?graphUuid=' + encodeURIComponent(reference.target.graphUuid) + '&referenceUuid=' + encodeURIComponent(reference.uuid))
  }
  const startAction = (graphUuid: string, parent?: ActionNode) => {
    const nodes = actions.filter((node) => node.graphUuid === graphUuid)
    if (!graphs.some((graph) => graph.uuid === graphUuid) || (parent ? !nodes.some((node) => node.uuid === parent.uuid) : nodes.length > 0)) {
      return
    }
    setLastGraphUuid(graphUuid)
    navigate(actionWorkspaceHash({ mode: 'action', graphUuid, parentUuid: parent?.uuid }))
  }
  const createGraph = async (input: CreateGraphInput) => {
    const graph = await commands.graphCreate.mutateAsync(input)
    openGraph(graph.uuid)
  }
  const startExpression = (node: ActionNode) => {
    if (!canEditActionExpression(actions, node.uuid)) {
      return
    }
    navigate(actionWorkspaceHash({ mode: 'expression', graphUuid: node.graphUuid, nodeUuid: node.uuid }))
  }
  const startAgreement = (node: ActionNode) => {
    if (!canEditActionAgreement(actions, node.uuid)) return
    navigate(actionWorkspaceHash({ mode: 'agreement', graphUuid: node.graphUuid, nodeUuid: node.uuid }))
  }
  // ── 写操作 ──
  // mutateAsync 等待服务确认后才返回成功；expectedVersion 防止覆盖已被别人修改的版本。
  const confirmExpression = async (input: NonNullable<GenerationView['updateExpression']>) => {
    if (!workspaceActionUuid || !workspaceGraphUuid) {
      return false
    }
    const node = actions.find((item) => item.uuid === workspaceActionUuid)
    if (!node) {
      return false
    }
    if (input.nodeUuid !== node.uuid) return false
    await commands.expressionUpdate.mutateAsync(input)
    openGraph(workspaceGraphUuid)
    return true
  }
  const confirmAgreement = async (input: NonNullable<GenerationView['updateAgreement']>) => {
    if (workspaceMode !== 'agreement' || !workspaceActionUuid || !workspaceGraphUuid || input.nodeUuid !== workspaceActionUuid) {
      return false
    }
    await commands.agreementUpdate.mutateAsync({ ...input, document: { mode: 'clear' } })
    openGraph(workspaceGraphUuid)
    return true
  }
  // 节点详情里的 AI 草案可以直接发布，不必强迫作者再对话一轮。
  const publishExpressionDraft = async () => {
    if (!expressionAction || !workspaceGraphUuid) return false
    await commands.nodeDocumentPublish.mutateAsync({ nodeUuid: expressionAction.uuid, expectedVersion: expressionAction.version ?? 0, kind: 'expression' })
    openGraph(workspaceGraphUuid)
    return true
  }
  const publishAgreementDraft = async () => {
    if (!expressionAction || !workspaceGraphUuid) return false
    await commands.nodeDocumentPublish.mutateAsync({ nodeUuid: expressionAction.uuid, expectedVersion: expressionAction.version ?? 0, kind: 'agreement' })
    openGraph(workspaceGraphUuid)
    return true
  }
  const updateGraph = async (graphUuid: string, patch: Pick<Graph, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => {
    const graph = graphs.find((item) => item.uuid === graphUuid)
    if (!graph) {
      throw new Error('行动图不存在')
    }
    const avatarAssetUuid = await imageAsset(patch.avatar, graph.avatar, graph.avatarAssetUuid)
    const backgroundAssetUuid = await imageAsset(patch.backgroundImage, graph.backgroundImage, graph.backgroundAssetUuid)
    await commands.graphUpdate.mutateAsync({ graphUuid: graphUuid, expectedVersion: graph.version, title: patch.title, description: patch.description, avatarAssetUuid, backgroundAssetUuid })
  }
  const deleteGraph = async (graphUuid: string, expectedNodeCount: number) => {
    const graph = graphs.find((item) => item.uuid === graphUuid)
    if (!graph) {
      return false
    }
    await commands.graphDelete.mutateAsync({ graphUuid: graphUuid, expectedVersion: graph.version, expectedNodeCount })
    setLastGraphUuid('')
    setArchiveActionId(undefined)
    navigate('graphs')
    return true
  }
  const confirmAction = async (input: CreateActionInput) => {
    if (!workspaceGraph || (workspaceParentUuid && !workspaceParent)) {
      return false
    }
    if (input.graphUuid !== workspaceGraph.uuid || input.parentUuid !== workspaceParent?.uuid) return false
    const action = await commands.actionCreate.mutateAsync(input)
    openNode({ ...action, graphUuid: action.graphUuid }, 'objective')
    if (action.expressionStatus === 'pending' || action.agreementStatus === 'pending') void generateNodeDocuments(action.uuid).catch(() => undefined)
    return true
  }
  const setUserFollow = async (id: string, following: boolean) => {
    await commands.followUpdate.mutateAsync({ kind: 'user', targetUuid: id, following })
    return true
  }
  const setGraphFollow = async (id: string, following: boolean) => {
    await commands.followUpdate.mutateAsync({ kind: 'graph', targetUuid: id, following })
    return true
  }
  const saveProfile = async (value: UserProfile) => {
    const avatarAssetUuid = await imageAsset(value.avatar, profile.avatar, profile.avatarAssetUuid)
    const backgroundAssetUuid = await imageAsset(value.backgroundImage, profile.backgroundImage, profile.backgroundAssetUuid)
    await commands.profileUpdate.mutateAsync({ name: value.name, bio: value.bio, gender: value.gender, locationCode: value.location?.code ?? null, avatarAssetUuid, backgroundAssetUuid, expectedVersion: profile.version })
  }
  const profileReturnGraph = route === 'profile' ? query.get('fromGraph') : null
  const profileReturn = profileReturnGraph ? () => openGraph(profileReturnGraph) : () => navigate(profileBackHash)
  const viewingOwnProfile = route === 'profile' && query.get('userUuid') === profile.uuid
  const personalAreaActive = route === 'my' || route === 'profile'

  // ── 页面渲染 ──
  // hidden 而非卸载，保留各 Tab 的列表、筛选和阅读位置。
  return (
    <AppShell
      profile={profile}
      profileStats={profileStats}
      activeView={viewingOwnProfile ? 'my' : route}
      darkMode={darkMode}
      graphTitle={selectedGraph?.title}
      backAction={
        route === 'graph-search' ? { label: '返回发现', onBack: () => navigate('home') }
          : route === 'graphs' ? { label: '返回我的', onBack: () => navigate('my') }
            : route === 'graph' ? { label: '返回列表', onBack: () => navigate(graphBackHash) }
              : route === 'profile' && (!viewingOwnProfile || profileBackHash !== 'my')
                ? { label: profileReturnGraph ? '返回行动图' : '返回', onBack: profileReturn }
                : undefined
      }
      onToggleTheme={toggleTheme}
      onLogout={onLogout}
    >
      <div hidden={!personalAreaActive}>
        <ProfilePage
          users={allUsers} graphs={graphs} actions={actions}
          currentUserUuid={profile.uuid} followingIds={followingIds} active={personalAreaActive}
          onCreateGraph={createGraph} onSetUserFollow={setUserFollow}
          onOpenGraph={openGraph} onOpenNode={openNode} onOpenReference={openReference}
        />
      </div>
      <div hidden={route !== 'home'}>
        <FeedPage
          actions={actions} graphs={graphs} users={allUsers} active={route === 'home'}
          onOpenGraph={openGraph} onOpenNode={openNode}
          onOpenReference={openReference} onSearchGraphs={openGraphSearch}
        />
      </div>
      {route === 'graph-search' && (
        <GraphSearchResultsPage
          params={query} graphs={graphs} actions={actions}
          onOpenGraph={openGraph} onSearch={openGraphSearch}
          onPageChange={(page) => openGraphSearch(query.get('query') ?? '', page)}
        />
      )}
      <div hidden={route !== 'following'}>
        <FollowingPage
          actions={actions} graphs={graphs} users={allUsers}
          sources={{ userUuids: followingIds, graphUuids: followingGraphUuids }} active={route === 'following'}
          onOpenGraph={openGraph} onOpenNode={openNode} onOpenReference={openReference}
          onSetGraphFollow={setGraphFollow} onSetUserFollow={setUserFollow}
        />
      </div>
      <div hidden={route !== 'graphs'}>
        <GraphsPage
          currentUserUuid={profile.uuid} graphs={graphs} actions={actions}
          onCreateGraph={createGraph} onOpenGraph={openGraph}
        />
      </div>
      {selectedGraph && (
        <div hidden={route !== 'graph'}>
          <GraphPage
            key={selectedGraph.uuid} active={route === 'graph'} graph={selectedGraph}
            externalFocus={externalFocus} currentUserUuid={profile.uuid} users={allUsers}
            actions={selectedGraphActions} showActionGraphLegend={showActionGraphLegend}
            graphBackground={graphBackground}
            onCreateAction={startAction}
            onPublishNodeDocument={async (nodeUuid, expectedVersion, kind) => { await commands.nodeDocumentPublish.mutateAsync({ nodeUuid, expectedVersion, kind }) }}
            onDeleteNode={async (node) => { await commands.actionDelete.mutateAsync({ nodeUuid: node.uuid, expectedVersion: node.version ?? 0 }) }}
            onContinueAction={(node) => startAction(selectedGraph.uuid, node)}
            onOpenActionArchive={(node) => {
              setLastGraphUuid(node.graphUuid)
              setArchiveActionId(node.uuid)
              navigate('action-archive')
            }}
            onUpdateGraph={updateGraph} onEditExpression={startExpression}
            onEditAgreement={startAgreement} onDeleteGraph={deleteGraph}
            following={followingGraphUuids.includes(selectedGraph.uuid)} onSetGraphFollow={setGraphFollow}
          />
        </div>
      )}
      {route === 'publish' && (
        <WorkspaceOutlet
          mode={workspaceMode}
          graph={workspaceGraph}
          parent={workspaceParent}
          parentUuid={workspaceParentUuid}
          node={expressionAction}
          actions={actions}
          profile={profile}
          users={allUsers}
          contextGuide={workspaceGraph?.contextGuide}
          onBack={openGraph}
          onConfirmAction={confirmAction}
          onConfirmExpression={confirmExpression}
          onConfirmAgreement={confirmAgreement}
          onPublishExpressionDraft={publishExpressionDraft}
          onPublishAgreementDraft={publishAgreementDraft}
        />
      )}
      {route === 'action-archive' && (
        archiveAction && selectedGraph ? (
          <ActionArchivePage
            graph={selectedGraph} node={archiveAction} actions={selectedGraphActions} users={allUsers}
            onBack={() => openGraph(selectedGraph.uuid)}
            onSelectSource={(id) => {
              setArchiveActionId(id)
              window.scrollTo(0, 0)
            }}
          />
        ) : (
          <div className="empty-state">
            <p>请从行动节点查看形成过程</p>
            <a className="quiet-button" href="#graphs">浏览行动图</a>
          </div>
        )
      )}
      {route === 'graph' && !selectedGraph && (
        <div className="empty-state">
          <p>行动图不存在或已删除</p>
          <a className="quiet-button" href="#graphs">浏览行动图</a>
        </div>
      )}
      <div hidden={route !== 'settings'}>
        <SettingsPanel
          profile={profile} darkMode={darkMode} showActionGraphLegend={showActionGraphLegend}
          graphBackground={graphBackground} onGraphBackgroundChange={setGraphBackground}
          onSave={saveProfile} onToggleTheme={toggleTheme}
          onShowActionGraphLegendChange={setShowActionGraphLegend}
        />
      </div>
    </AppShell>
  )
}
