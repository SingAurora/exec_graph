import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphCatalogue } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContexts } from '../../entities/action/api/context'
import { profileKeys, readProfileCatalogue, type AccountProfile } from '../../entities/profile/api/profiles'
import { followingKeys, readFollowing } from '../../entities/following/api/following'
import type { AuthStatus } from '../../features/auth/model/auth-store'

/** 读取页面所需业务数据；当前用户由 AuthStore 提供，不再查询 session。 */
export function useAppResources(user: AccountProfile | null, authStatus: AuthStatus) {
  const signedIn = Boolean(user)
  const publicEnabled = authStatus === 'signed-in' || authStatus === 'signed-out'
  const scope = user?.uuid ?? 'public'
  const graphs = useQuery({ queryKey: graphKeys.catalogue(scope), queryFn: ({ signal }) => readGraphCatalogue(signal), enabled: publicEnabled })
  const users = useQuery({ queryKey: profileKeys.catalogue(scope), queryFn: ({ signal }) => readProfileCatalogue(signal), enabled: publicEnabled })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })
  // 当前仍拉取全部图的完整行动上下文，再由前端计算内容流、搜索和图布局；后续再迁移远端分页。
  const graphUuids = graphs.data?.map((graph) => graph.uuid) ?? []
  const contexts = useQuery({ queryKey: actionKeys.contexts(scope, graphUuids), queryFn: ({ signal }) => readActionContexts(graphUuids, signal),
    enabled: publicEnabled && Boolean(graphs.data), placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined })
  const allUsers = useMemo(() => users.data ? (user ? [user, ...users.data.filter((item) => item.uuid !== user.uuid)] : users.data) : [], [user, users.data])
  const sources = signedIn ? following.data : { userUuids: [], graphUuids: [] }
  const error = graphs.error ?? users.error ?? following.error ?? contexts.error
  const ready = Boolean(graphs.data && users.data && contexts.data && (!signedIn || following.data))
  const retry = () => { if (publicEnabled) { void graphs.refetch(); void users.refetch(); if (graphs.data) void contexts.refetch(); if (signedIn) void following.refetch() } }
  return { graphs: graphs.data, actions: contexts.data, allUsers, sources, scope, ready, error, retry }
}
