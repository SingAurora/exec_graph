import { getAPI } from '../../../shared/api/client'
import type { Graph } from '../model/types'

/** 服务返回的图资料及并发版本；修改时提交看到的版本，防止静默覆盖。 */
export type GraphView = Graph & { version: number }

/** 按账号隔离的完整图目录缓存键，属于当前过渡读取方案。 */
export const graphKeys = {
  catalogue: (scope: string) => ['graphs', scope, 'catalogue'] as const,
  detail: (scope: string, graphUuid: string) => ['graphs', scope, 'detail', graphUuid] as const,
}

/** 读取图目录，供图列表、查找和活动统计使用，取消信号透传给统一客户端。 */
export function readGraphCatalogue(signal?: AbortSignal): Promise<GraphView[]> {
  return getAPI('/api/commands/graphs/catalogue', {}, { signal })
}

/** 读取单张图；图详情页不应先加载整个图目录。 */
export function readGraphDetail(graphUuid: string, signal?: AbortSignal): Promise<GraphView> {
  return getAPI('/api/commands/graphs/detail', { graphUuid }, { signal })
}
