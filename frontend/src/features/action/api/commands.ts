import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { ActionContextNode } from '../../../entities/action/api/context'

/** 请求显式传递文档处理意图；JSON 无法保留 undefined，必须区分继承、更新和清空。 */
export type DocumentUpdate = { mode: 'inherit' } | { mode: 'clear' } | { mode: 'update'; markdown: string }

/** 一个直接来源的约定核对；true 满足、false 不满足、null 尚未核对。 */
export type SourceAssessment = { sourceId: string; complies: boolean | null; exceptionReason?: string }

/** 发布参数携带引用来源版本，节点编号由服务分配；表达和后续约定各自声明处理方式。 */
export type CreateActionInput = {
  graphId: string
  generationId: string
  parentId?: string
  mergedParentIds: string[]
  sourceVersions: { nodeId: string; version: number }[]
  referenceAgreements: SourceAssessment[]
  images: { assetId: string; alt: string }[]
}

/** 发布一次行动，连同表达、后续约定、引用核对和形成对话提交业务接口。 */
export function createAction(input: CreateActionInput, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/actions/create', input, options)
}

/** 在已有节点保存连续 AI 对话形成的表达修改，不创建新行动。 */
export function reviseExpression(input: { nodeId: string; expectedVersion: number; generationId: string }, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/expressions/update', input, options)
}

/** 保存向后传递的约定修改，不回写本节点引用来源时的核对结果。 */
export function reviseAgreement(input: { nodeId: string; expectedVersion: number; document: DocumentUpdate }, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/agreements/update', input, options)
}

/** 将编辑器内部语义映射到请求：undefined 继承，空白清空，非空更新。 */
export function documentUpdate(markdown: string | undefined): DocumentUpdate {
  return markdown === undefined ? { mode: 'inherit' } : markdown.trim() ? { mode: 'update', markdown } : { mode: 'clear' }
}
