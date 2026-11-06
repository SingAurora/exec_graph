import { getAPI, postAPI } from '../../../shared/api/client'
import type { ActionContextNode } from '../../../entities/action/api/context'
import type { CreateActionInput, DocumentUpdate, SourceAssessment } from '../../action/api/commands'

/** 本轮上传的图片及用户备注；备注用于 AI 判断正文位置。 */
export type GeneratedImage = { assetId: string; alt: string }

/** 浏览器只提交本轮输入与选择；历史事实、图指引和对话由服务端读取。 */
export type GenerateInput = {
  mode: 'action' | 'expression' | 'agreement'; graphId: string; conversationId?: string
  nodeId?: string; expectedVersion?: number; messages: string[]; parentId?: string
  mergedParentIds: string[]; sourceVersions: { nodeId: string; version: number }[]; agreement: DocumentUpdate
  /** 作者正在调整的私有表达/约定草案；仅 expression/agreement 模式。 */
  currentDocument?: string
}
/** 保留提交身份以便响应丢失后重试，不重复调用平台模型。 */
export type GenerationRequest = { key: string; input: GenerateInput }
/** 生成结果与发布参数成套返回，前端不重新拼装 AI 正文。 */
export type GenerationView = {
  generationId: string; conversationId: string; status: 'pending' | 'succeeded' | 'failed'; model?: string; errorCode?: string
  draft?: { reply: string; title: string; objective: string; expression: DocumentUpdate; agreement?: DocumentUpdate; reviews: SourceAssessment[]; images?: GeneratedImage[]; invalidImages?: { ref: string; reason: string }[] }
  createAction?: CreateActionInput
  updateExpression?: { nodeId: string; expectedVersion: number; generationId: string }
  updateAgreement?: { nodeId: string; expectedVersion: number; generationId: string }
}

/** 已发布节点的独立表达/约定草案。 */
export type NodeDocument = { kind: 'expression' | 'agreement'; status: 'pending' | 'generating' | 'draft' | 'published' | 'failed'; draftMarkdown?: string; errorCode?: string; errorMessage?: string }

/** 行动发布后为节点生成表达和约定草案；失败时服务端保留 failed 状态。 */
export function generateNodeDocuments(nodeId: string, csrfToken: string): Promise<NodeDocument[]> {
  return postAPI('/api/commands/ai/node-documents', { nodeId }, { csrfToken, timeoutMs: 110_000 })
}

/** 节点已发布的表达/约定版本历史。 */
export type NodeDocumentVersion = { kind: 'expression' | 'agreement'; revision: number; mode: string; markdown: string; actorId: string; changeKind: string; generationId?: string; createdAt: string }

/** 读取节点自己的文档历史；只包含已发布版本。 */
export function getNodeDocumentHistory(nodeId: string): Promise<NodeDocumentVersion[]> {
  return getAPI('/api/commands/actions/document-history', { nodeId })
}

/** 读取作者自己的节点文档草案和状态。 */
export function getNodeDocuments(nodeId: string): Promise<NodeDocument[]> {
  return getAPI('/api/commands/actions/node-documents', { nodeId })
}

/** 将节点当前草案发布为版本；返回更新后的行动节点。 */
export function publishNodeDocument(nodeId: string, expectedVersion: number, kind: 'expression' | 'agreement', csrfToken: string): Promise<ActionContextNode> {
  return postAPI('/api/commands/actions/publish-document', { nodeId, expectedVersion, kind }, { csrfToken })
}

/** 只对已有行动草稿放置图片；服务端保证正文文字不变。 */
export function placeGenerationImages(generationId: string, images: GeneratedImage[], csrfToken: string): Promise<GenerationView> {
  return postAPI('/api/commands/ai/place-images', { generationId, images }, { csrfToken, timeoutMs: 110_000 })
}

/** 同键重试只读取已有任务；pending 时轮询私有结果，不再次生成。 */
export async function generateDraft(request: GenerationRequest, csrfToken: string, signal: AbortSignal): Promise<GenerationView> {
  let view = await postAPI<GenerationView, GenerateInput>('/api/commands/ai/generate', request.input, { csrfToken, idempotencyKey: request.key, timeoutMs: 110_000, signal })
  const deadline = Date.now() + 125_000
  while (view.status === 'pending' && Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error('请求已取消')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
    view = await getAPI('/api/commands/ai/generation', { generationId: view.generationId }, { signal })
  }
  return view
}
