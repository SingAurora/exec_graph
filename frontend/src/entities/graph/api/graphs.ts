import { getAPI } from '../../../shared/api/client'
import type { Graph } from '../model/types'

/** 服务返回的图资料及并发版本；修改时提交看到的版本，防止静默覆盖。 */
export type GraphView = Graph & { version: number }

/** 按账号隔离的完整图目录缓存键，属于当前过渡读取方案。 */
export const graphKeys = {
  detail: (scope: string, graphUuid: string) => ['graphs', scope, 'detail', graphUuid] as const,
}

/** 读取单张图；图详情页不应先加载整个图目录。 */
export function readGraphDetail(graphUuid: string, signal?: AbortSignal): Promise<GraphView> {
  return getAPI('/api/commands/graphs/detail', { graphUuid }, { signal })
}

export type GraphListParams = {
  page: number
  pageSize: number
  filter: 'all' | 'owned' | 'joined'
  keyword: string
  sort: 'activity' | 'created' | 'name'
}

export type GraphPage = {
  items: GraphView[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export const graphListKey = (scope: string, params: GraphListParams) => ['graphs', scope, 'list', params] as const

/** 图目录服务端筛选、搜索、排序分页。 */
export function readGraphPage(params: GraphListParams, signal?: AbortSignal): Promise<GraphPage> {
  return getAPI('/api/commands/graphs/list', {
    page: params.page,
    pageSize: params.pageSize,
    filter: params.filter,
    keyword: params.keyword,
    sort: params.sort,
  }, { signal })
}
