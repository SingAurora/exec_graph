import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphDetail } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContext } from '../../entities/action/api/context'
import { profileStatsKey, readProfileStats, type AccountProfile } from '../../entities/profile/api/profiles'
import type { UserProfile } from '../../entities/profile/model/types'
import { followingKeys, readFollowing } from '../../entities/following/api/following'
import type { AuthStatus } from '../../features/auth/model/auth-store'

/** 按路由读取业务数据：首页用 feed，图详情只读单图，主页/关注各用独立子图。 */
export function useAppResources(user: AccountProfile | null, authStatus: AuthStatus, route: string, graphUuid: string) {
  const signedIn = Boolean(user)
  const publicEnabled = authStatus === 'signed-in' || authStatus === 'signed-out'
  const graphRoute = route === 'graph' || route === 'publish' || route === 'action-archive'
  const graphListRoute = route === 'graphs' || route === 'graph-search'
  const profileRoute = route === 'profile' || route === 'my'
  const settingsRoute = route === 'settings'
  const scope = user?.uuid ?? 'public'

  const selectedGraph = useQuery({
    queryKey: graphKeys.detail(scope, graphUuid),
    queryFn: ({ signal }) => readGraphDetail(graphUuid, signal),
    enabled: publicEnabled && graphRoute && Boolean(graphUuid),
  })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })
  const profileStats = useQuery({ queryKey: profileStatsKey(user?.uuid ?? ''), queryFn: ({ signal }) => readProfileStats(user!.uuid, signal), enabled: signedIn })

  const selectedContext = useQuery({
    queryKey: actionKeys.context(scope, graphUuid),
    queryFn: ({ signal }) => readActionContext(graphUuid, signal),
    enabled: publicEnabled && graphRoute && Boolean(graphUuid),
  })

  const graphs = useMemo(() => graphRoute ? (selectedGraph.data ? [selectedGraph.data] : []) : [], [graphRoute, selectedGraph.data])
  const actions = useMemo(() => graphRoute ? (selectedContext.data ?? []) : [], [graphRoute, selectedContext.data])

  // 用户资料跟着行动和关注集合返回；这里只组装展示所需的查找表。
  const users = useMemo(() => {
    const byId = new Map<string, UserProfile>()
    if (user) byId.set(user.uuid, user)
    for (const node of actions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    for (const profile of following.data?.users ?? []) if (!byId.has(profile.uuid)) byId.set(profile.uuid, profile)
    return [...byId.values()]
  }, [actions, following.data?.users, user])
  const sources = signedIn && following.data ? following.data : { userUuids: [], graphUuids: [], users: [] }
  const error = graphRoute ? (selectedGraph.error ?? selectedContext.error ?? profileStats.error) : (following.error ?? profileStats.error)
  const statsReady = !signedIn || Boolean(profileStats.data)
  const ready = graphListRoute
    ? Boolean(statsReady && (!signedIn || following.data))
    : profileRoute || settingsRoute
        ? Boolean(statsReady && (!signedIn || following.data))
        : graphRoute
          ? Boolean(selectedGraph.data && selectedContext.data && statsReady && (!signedIn || following.data))
          : Boolean(statsReady && (!signedIn || following.data))
  const retry = () => {
    if (!publicEnabled) return
    if (graphRoute) {
      void selectedGraph.refetch()
      void selectedContext.refetch()
    }
    if (signedIn) { void following.refetch(); void profileStats.refetch() }
  }
  return { graphs, actions, users, sources, profileStats: profileStats.data, scope, ready, error, retry }
}
