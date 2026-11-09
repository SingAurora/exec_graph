import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphKeys, readGraphDetail } from '../../entities/graph/api/graphs'
import { actionKeys, readActionContext } from '../../entities/action/api/context'
import type { UserProfile } from '../../entities/profile/model/types'

/** 图详情、发布与形成过程共用的单图读取；只在需要的路由启用。 */
export function useGraphContext(scope: string, graphUuid: string, enabled: boolean) {
  const graph = useQuery({ queryKey: graphKeys.detail(scope, graphUuid), queryFn: ({ signal }) => readGraphDetail(graphUuid, signal), enabled: enabled && Boolean(graphUuid) })
  const context = useQuery({ queryKey: actionKeys.context(scope, graphUuid), queryFn: ({ signal }) => readActionContext(graphUuid, signal), enabled: enabled && Boolean(graphUuid) })
  const actions = useMemo(() => context.data ?? [], [context.data])
  const graphs = graph.data ? [graph.data] : []
  const users = useMemo(() => {
    const byId = new Map<string, UserProfile>()
    for (const node of actions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    return [...byId.values()]
  }, [actions])
  return { graph: graph.data, graphs, actions, users, error: graph.error ?? context.error, loading: !graph.data || !context.data }
}
