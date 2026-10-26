import { postJSON } from '../../../shared/api/client'

/** 文档生成的模型消息；system 提供规则，user／assistant 表示连续对话。 */
export type AICompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type CompletionRequest = {
  model: string
  messages: AICompletionMessage[]
  response_format?: { type: 'json_object' }
  thinking: { type: 'disabled' }
}

type CompletionResponse = { choices?: Array<{ message?: { content?: string } }> }

/** 统一使用平台默认模型；密钥仅由服务端代理注入，浏览器不接收或传递密钥。 */
export async function requestAICompletion(messages: AICompletionMessage[], json = false): Promise<CompletionResponse> {
  return postJSON<CompletionResponse, CompletionRequest>('/platform-ai-api/v1/chat/completions', {
    model: 'deepseek-flash',
    messages,
    ...(json ? { response_format: { type: 'json_object' as const } } : {}),
    thinking: { type: 'disabled' },
  })
}
