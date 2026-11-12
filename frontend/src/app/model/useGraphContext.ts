import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphKeys, readGraphDetail } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContext } from '../../entities/action/api/context'
import type { UserProfile } from '../../entities/profile/model/types'

/** 图详情、发布与形成过程共用的单图读取；只在需要的路由启用。detailActive 表示当前确实在图详情页，用于每次重新进入时强制刷新。 */
export function useGraphContext(scope: string, graphUuid: string, enabled: boolean, detailActive = enabled) {
  const graph = useQuery({ queryKey: graphKeys.detail(scope, graphUuid), queryFn: ({ signal }) => readGraphDetail(graphUuid, signal), enabled: enabled && Boolean(graphUuid) })
  const context = useQuery({ queryKey: actionKeys.context(scope, graphUuid), queryFn: ({ signal }) => readActionContext(graphUuid, signal), enabled: enabled && Boolean(graphUuid) })
  const { refetch: refetchGraph, isFetched: graphFetched } = graph
  const { refetch: refetchContext, isFetched: contextFetched } = context
  const active = useRef(false)
  const activeGraph = useRef('')
  const activeDetail = useRef(false)
  // 离开图详情后再次进入时，即使 Query 仍持有上一次的 data，也重新读取图和行动。
  // 发布/形成过程仍复用同一图上下文，但只有真正回到图详情才算重新进入。
  // 首次进入交给 useQuery 自己加载，避免挂载时多打一次请求。
  useEffect(() => {
    if (!enabled || !graphUuid) {
      active.current = false
      activeGraph.current = ''
      activeDetail.current = false
      return
    }
    const enteringDetail = detailActive && !activeDetail.current
    const entered = !active.current || activeGraph.current !== graphUuid
    active.current = true
    activeGraph.current = graphUuid
    activeDetail.current = detailActive
    if (!entered && !enteringDetail) return
    if (graphFetched || contextFetched) {
      void refetchGraph()
      void refetchContext()
    }
  }, [enabled, graphUuid, detailActive, graphFetched, contextFetched, refetchGraph, refetchContext])
  const actions = useMemo(() => context.data ?? [], [context.data])
  const graphs = graph.data ? [graph.data] : []
  const users = useMemo(() => {
    const byId = new Map<string, UserProfile>()
    for (const node of actions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    return [...byId.values()]
  }, [actions])
  return { graph: graph.data, graphs, actions, users, error: graph.error ?? context.error, loading: enabled && (!graph.data || !context.data) }
}
