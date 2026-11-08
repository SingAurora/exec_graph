import { getAPI } from '../../../shared/api/client'
import type { ActionNode } from '../model/types'

/** 过渡期完整行动 DTO：Omit 去掉 UI 的 graphUuid，改用接口 graphUuid，并附并发版本。 */
export type ActionContextNode = Omit<ActionNode, 'graphUuid'> & { graphUuid: string; version: number }

/** UI 使用的行动模型加上服务版本，更新时通过 expectedVersion 检查冲突。 */
export type VersionedAction = ActionNode & { version: number }

/** Query 缓存键：同时隔离账号和图集合；排序后相同图集合使用同一份缓存。 */
export const actionKeys = {
  scope: (scope: string) => ['actions', scope] as const,
  contexts: (scope: string, graphUuids: string[]) => ['actions', scope, 'contexts', [...graphUuids].sort()] as const,
}

/** 显式把接口 graphUuid 映射成 UI 沿用的 graphUuid，不能只靠类型断言混用字段。 */
export function actionFromView({ graphUuid, ...node }: ActionContextNode): VersionedAction {
  return { ...node, graphUuid: graphUuid }
}

/** 并行读取各图完整上下文再合并；当前是原型过渡接口，尚未实现远端内容流分页。 */
export async function readActionContexts(graphUuids: string[], signal?: AbortSignal): Promise<VersionedAction[]> {
  const groups = await Promise.all(graphUuids.map((graphUuid) => getAPI<ActionContextNode[]>('/api/commands/actions/context', { graphUuid }, { signal })))
  return groups.flat().map(actionFromView)
}
