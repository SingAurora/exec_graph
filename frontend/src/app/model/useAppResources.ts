import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphCatalogue } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContexts } from '../../entities/action/api/context'
import type { AccountProfile } from '../../entities/profile/api/profiles'
import type { UserProfile } from '../../entities/profile/model/types'
import { followingKeys, readFollowing } from '../../entities/following/api/following'
import type { AuthStatus } from '../../features/auth/model/auth-store'

/** 读取页面所需业务数据；当前用户由 AuthStore 提供，不再查询 session。 */
export function useAppResources(user: AccountProfile | null, authStatus: AuthStatus) {
  const signedIn = Boolean(user)
  const publicEnabled = authStatus === 'signed-in' || authStatus === 'signed-out'
  const scope = user?.uuid ?? 'public'
  const graphs = useQuery({ queryKey: graphKeys.catalogue(scope), queryFn: ({ signal }) => readGraphCatalogue(signal), enabled: publicEnabled })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })
  // 当前仍拉取全部图的完整行动上下文，再由前端计算内容流、搜索和图布局；后续再迁移远端分页。
  const graphUuids = graphs.data?.map((graph) => graph.uuid) ?? []
  const contexts = useQuery({ queryKey: actionKeys.contexts(scope, graphUuids), queryFn: ({ signal }) => readActionContexts(graphUuids, signal),
    enabled: publicEnabled && Boolean(graphs.data), placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined })
  // 用户资料跟着行动和关注集合返回；这里只组装展示所需的查找表，不再单独请求用户目录。
  const users = useMemo(() => {
    const byId = new Map<string, UserProfile>()
    if (user) byId.set(user.uuid, user)
    for (const node of contexts.data ?? []) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    for (const profile of following.data?.users ?? []) if (!byId.has(profile.uuid)) byId.set(profile.uuid, profile)
    return [...byId.values()]
  }, [contexts.data, following.data?.users, user])
  const sources = signedIn && following.data ? following.data : { userUuids: [], graphUuids: [], users: [] }
  const error = graphs.error ?? following.error ?? contexts.error
  const ready = Boolean(graphs.data && contexts.data && (!signedIn || following.data))
  const retry = () => { if (publicEnabled) { void graphs.refetch(); if (graphs.data) void contexts.refetch(); if (signedIn) void following.refetch() } }
  return { graphs: graphs.data, actions: contexts.data, users, sources, scope, ready, error, retry }
}
