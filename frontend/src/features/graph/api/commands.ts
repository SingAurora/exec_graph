import { getAPI, postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { GraphView } from '../../../entities/graph/api/graphs'
import type { CreateGraphInput } from '../model/types'

/** Graph settings accepted by the versioned update command. */
export type UpdateGraphInput = { graphId: string; expectedVersion: number; title: string; description: string; avatarAssetId: string | null; backgroundAssetId: string | null }

/** Creates an empty graph; its first action is a separate command. */
export function createGraph(input: CreateGraphInput, options: BusinessRequestOptions): Promise<GraphView> {
  return postAPI('/api/commands/graphs/create', input, options)
}

/** Saves graph identity only if the current version is still editable. */
export function updateGraph(input: UpdateGraphInput, options: BusinessRequestOptions): Promise<GraphView> {
  return postAPI('/api/commands/graphs/update', input, options)
}

/** Removes a graph after server-side participant and node-count checks. */
export function removeGraph(input: { graphId: string; expectedVersion: number; expectedNodeCount: number }, options: BusinessRequestOptions): Promise<null> {
  return postAPI('/api/commands/graphs/delete', input, options)
}

/** 设置页只读展示的生成目标、核验规则与输出契约。 */
export type PromptDefaults = { contract: string; action: string; expression: string; agreement: string; verificationAction: string; verificationExpression: string; verificationAgreement: string }

/** 读取当前版本的默认提示词；不提交、不修改图级配置。 */
export function getPromptDefaults(): Promise<PromptDefaults> {
  return getAPI('/api/commands/ai/prompt-defaults')
}
