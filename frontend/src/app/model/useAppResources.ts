import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphCatalogue } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContexts } from '../../entities/action/api/context'
import { profileKeys, readProfileCatalogue, readSession } from '../../entities/profile/api/profiles'
import { followingKeys, readFollowing } from '../../entities/following/api/following'

/** 自定义 Hook：集中读取页面所需资料，业务事实只保存在 Query 缓存中。 */
export function useAppResources() {
  // queryKey 标识一份缓存，queryFn 负责请求；signal 透传后，Query 可以取消过时的读取。
  const session = useQuery({ queryKey: profileKeys.session, queryFn: ({ signal }) => readSession(signal) })
  // 先取得会话，再读取账号作用域内的资料；不同账号的 queryKey 不共享业务缓存。
  // 未登录也读取公开目录和行动上下文；只有会话作用域数据（关注）需要登录。
  const scope = session.data?.user.uuid ?? 'anonymous'
  const signedIn = Boolean(session.data?.user)
  const publicEnabled = session.isSuccess
  const graphs = useQuery({ queryKey: graphKeys.catalogue(scope), queryFn: ({ signal }) => readGraphCatalogue(signal), enabled: publicEnabled })
  const users = useQuery({ queryKey: profileKeys.catalogue(scope), queryFn: ({ signal }) => readProfileCatalogue(signal), enabled: publicEnabled })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })
  // 原型暂时拉取全部图的完整行动上下文，再由前端计算内容流、搜索和图布局。
  // 未来远端分页应替换这一读取边界，不能把本地切片当成服务端分页。
  const graphUuids = graphs.data?.map((graph) => graph.uuid) ?? []
  const contexts = useQuery({ queryKey: actionKeys.contexts(scope, graphUuids), queryFn: ({ signal }) => readActionContexts(graphUuids, signal),
    enabled: publicEnabled && Boolean(graphs.data), placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined })
  const profile = session.data?.user
  // 公开目录包含邮箱；本人资料以会话接口返回的版本为准。
  const allUsers = useMemo(() => users.data ? (profile ? [profile, ...users.data.filter((user) => user.uuid !== profile.uuid)] : users.data) : [], [profile, users.data])
  const sources = signedIn ? following.data : { userUuids: [], graphUuids: [] }
  const error = session.error ?? graphs.error ?? users.error ?? following.error ?? contexts.error
  const ready = Boolean(graphs.data && users.data && contexts.data && (!signedIn || following.data))
  const retry = () => { void session.refetch(); if (publicEnabled) { void graphs.refetch(); void users.refetch(); if (graphs.data) void contexts.refetch(); if (signedIn) void following.refetch() } }
  return { anonymous: session.isSuccess && session.data === null, profile, graphs: graphs.data, actions: contexts.data, allUsers, sources, scope, ready, error, retry }
}
