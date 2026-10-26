import { getAPI, postAPI } from '../../../shared/api/client'
import type { CreateActionInput, DocumentUpdate, SourceAssessment } from '../../action/api/commands'

/** 浏览器只提交本轮输入与选择；历史事实、图指引和对话由服务端读取。 */
export type GenerateInput = {
  mode: 'action' | 'expression'; graphId: string; conversationId?: string
  nodeId?: string; expectedVersion?: number; message: string; parentId?: string
  mergedParentIds: string[]; sourceVersions: { nodeId: string; version: number }[]; agreement: DocumentUpdate
}
/** 保留提交身份以便响应丢失后重试，不重复调用平台模型。 */
export type GenerationRequest = { key: string; input: GenerateInput }
/** 生成结果与发布参数成套返回，前端不重新拼装 AI 正文。 */
export type GenerationView = {
  generationId: string; conversationId: string; status: 'pending' | 'succeeded' | 'failed'; errorCode?: string
  draft?: { reply: string; title: string; objective: string; expression: DocumentUpdate; reviews: SourceAssessment[] }
  createAction?: CreateActionInput
  updateExpression?: { nodeId: string; expectedVersion: number; generationId: string }
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
