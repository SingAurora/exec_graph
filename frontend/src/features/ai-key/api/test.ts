import type { AIKeyConfig } from '../../../entities/ai-key/model/types'
import { requestAICompletion } from './completion'

/** Sends a minimal request to verify that an AI configuration is usable. */
export async function testAIConfig(config: AIKeyConfig) {
  const result = await requestAICompletion(config, [{ role: 'user', content: '请只回复：连接成功' }])

  if (!result.choices?.[0]?.message?.content?.trim()) throw new Error('AI 没有返回有效消息。')
}
