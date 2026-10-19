import type { AIKeyConfig } from '../../../entities/ai-key/model/types'
import { aiProviders, platformAIConfig } from '../../../entities/ai-key/model/catalog'
import { postJSON } from '../../../shared/api/client'

/** Message shared by document generation and connection checks. */
export type AICompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type CompletionRequest = {
  model: string
  messages: AICompletionMessage[]
  response_format?: { type: 'json_object' }
  thinking?: { type: 'disabled' }
  reasoning_effort?: 'low'
}

type CompletionResponse = { choices?: Array<{ message?: { content?: string } }> }

/** Calls an allowed official model using either the platform key or the user's own key. */
export async function requestAICompletion(config: AIKeyConfig, messages: AICompletionMessage[], json = false): Promise<CompletionResponse> {
  const provider = aiProviders.find((item) => item.id === config.provider)
  if (!provider || !provider.models.some((model) => model.id === config.model)) throw new Error('请选择支持的 DeepSeek 或 GPT 模型。')
  if (config.baseUrl !== provider.baseUrl) throw new Error('仅支持官方服务地址，请重新保存 AI 配置。')
  const platform = config.source === 'platform'
  const apiKey = config.apiKey?.trim()
  if (platform && (config.id !== platformAIConfig.id || config.provider !== platformAIConfig.provider || config.model !== platformAIConfig.model)) throw new Error('默认 AI 配置无效。')
  if (!platform && !apiKey) throw new Error('请填写自己的 API Key，或切换到默认配置。')

  const endpoint = platform ? '/platform-ai-api/v1/chat/completions' : config.provider === 'deepseek' ? '/deepseek-api/v1/chat/completions' : '/openai-api/v1/chat/completions'
  return postJSON<CompletionResponse, CompletionRequest>(endpoint, {
    model: config.model,
    messages,
    ...(json ? { response_format: { type: 'json_object' as const } } : {}),
    ...(config.provider === 'deepseek' ? { thinking: { type: 'disabled' as const } } : { reasoning_effort: 'low' as const }),
  }, { headers: platform ? undefined : { Authorization: `Bearer ${apiKey}` } })
}
