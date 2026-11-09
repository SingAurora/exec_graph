import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphCatalogue, readGraphDetail } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContexts } from '../../entities/action/api/context'
import type { AccountProfile } from '../../entities/profile/api/profiles'
import type { UserProfile } from '../../entities/profile/model/types'
import { followingKeys, readFollowing } from '../../entities/following/api/following'
import type { AuthStatus } from '../../features/auth/model/auth-store'

/** 按路由读取业务数据：首页用 feed，图详情只读单图，其余页面暂保持全量读取。 */
export function useAppResources(user: AccountProfile | null, authStatus: AuthStatus, route: string, graphUuid: string) {
  const signedIn = Boolean(user)
  const publicEnabled = authStatus === 'signed-in' || authStatus === 'signed-out'
  const graphRoute = route === 'graph'
  const fullData = route !== 'home' && !graphRoute
  const scope = user?.uuid ?? 'public'

  const catalogue = useQuery({ queryKey: graphKeys.catalogue(scope), queryFn: ({ signal }) => readGraphCatalogue(signal), enabled: publicEnabled && fullData })
  const selectedGraph = useQuery({
    queryKey: graphKeys.detail(scope, graphUuid),
    queryFn: ({ signal }) => readGraphDetail(graphUuid, signal),
    enabled: publicEnabled && graphRoute && Boolean(graphUuid),
  })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })

  const catalogueUuids = catalogue.data?.map((graph) => graph.uuid) ?? []
  const catalogueContexts = useQuery({
    queryKey: actionKeys.contexts(scope, catalogueUuids),
    queryFn: ({ signal }) => readActionContexts(catalogueUuids, signal),
    enabled: publicEnabled && fullData && Boolean(catalogue.data),
    placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined,
  })
  const selectedContext = useQuery({
    queryKey: actionKeys.contexts(scope, graphUuid ? [graphUuid] : []),
    queryFn: ({ signal }) => readActionContexts([graphUuid], signal),
    enabled: publicEnabled && graphRoute && Boolean(graphUuid),
  })

  const graphs = useMemo(() => graphRoute ? (selectedGraph.data ? [selectedGraph.data] : []) : (catalogue.data ?? []), [catalogue.data, graphRoute, selectedGraph.data])
  const actions = useMemo(() => graphRoute ? (selectedContext.data ?? []) : (catalogueContexts.data ?? []), [catalogueContexts.data, graphRoute, selectedContext.data])

  // 用户资料跟着行动和关注集合返回；这里只组装展示所需的查找表。
  const users = useMemo(() => {
    const byId = new Map<string, UserProfile>()
    if (user) byId.set(user.uuid, user)
    for (const node of actions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    for (const profile of following.data?.users ?? []) if (!byId.has(profile.uuid)) byId.set(profile.uuid, profile)
    return [...byId.values()]
  }, [actions, following.data?.users, user])
  const sources = signedIn && following.data ? following.data : { userUuids: [], graphUuids: [], users: [] }
  const error = graphRoute ? (selectedGraph.error ?? selectedContext.error) : (catalogue.error ?? catalogueContexts.error ?? following.error)
  const ready = !fullData && !graphRoute
    ? true
    : graphRoute
      ? Boolean(selectedGraph.data && selectedContext.data && (!signedIn || following.data))
      : Boolean(catalogue.data && catalogueContexts.data && (!signedIn || following.data))
  const retry = () => {
    if (!publicEnabled) return
    if (graphRoute) {
      void selectedGraph.refetch()
      void selectedContext.refetch()
    } else if (fullData) {
      void catalogue.refetch()
      if (catalogue.data) void catalogueContexts.refetch()
    }
    if (signedIn) void following.refetch()
  }
  return { graphs, actions, users, sources, scope, ready, error, retry }
}
