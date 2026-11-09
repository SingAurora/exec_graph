import { getAPI } from '../../../shared/api/client'
import { actionFromView, type ActionContextNode, type VersionedAction } from './context'
import type { GraphView } from '../../graph/api/graphs'

export type FeedKind = 'expressions' | 'agreements'

/** 服务端内容流的一页；actions 已经包含本页计算继承和来源所需的祖先节点。 */
export type FeedView = {
  actions: VersionedAction[]
  graphs: GraphView[]
  total: number
  hasMore: boolean
}

type FeedResponse = {
  actions: ActionContextNode[]
  graphs: GraphView[]
  total: number
  hasMore: boolean
}

/** 首页内容流缓存键；不同 tab 和页码互不覆盖。 */
export const feedKeys = {
  page: (kind: FeedKind) => ['feed', kind] as const,
}

/** 读取表达或约定内容流；服务端负责分页和祖先子图。 */
export async function readFeed(kind: FeedKind, page: number, signal?: AbortSignal): Promise<FeedView> {
  const data = await getAPI<FeedResponse>('/api/commands/actions/feed', { kind, page, limit: 20 }, { signal })
  return { ...data, actions: data.actions.map(actionFromView) }
}
