import type { AIKeyConfig } from '../../../entities/ai-key/model/types'
import { postJSON } from '../../../shared/api/client'

type ConnectionTestResponse = {
  choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
}

type ConnectionTestRequest = {
  model: string
  messages: Array<{ role: 'user'; content: string }>
  temperature: number
  max_tokens: number
}

/** Sends a minimal request to verify that an AI configuration is usable. */
export async function testAIConfig(config: AIKeyConfig) {
  if (config.provider !== 'deepseek') throw new Error('演示页目前只接入 DeepSeek。')
  if (!config.model.trim() || !config.baseUrl.trim()) throw new Error('模型和服务地址不能为空。')

  const result = await postJSON<ConnectionTestResponse, ConnectionTestRequest>('/deepseek-api/v1/chat/completions', {
    model: config.model,
    messages: [{ role: 'user', content: '请只回复：连接成功' }],
    temperature: 0,
    max_tokens: 64,
  }, { headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined })

  if (!result.choices?.[0]?.message) throw new Error('AI 没有返回有效消息。')
}
