import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { aiProviders, platformAIConfig } from '../../../entities/ai-key/model/catalog.ts'
import { requestAICompletion } from './completion.ts'
import { testAIConfig } from './test.ts'
import { generateAIDocument } from './chat.ts'

let fetchSpy
let requests
const messages = [{ role: 'user', content: '我做完了一顿饭' }]
function mockReply(content = '连接成功') {
  requests = []
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    return new globalThis.Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  })
}
afterEach(() => fetchSpy?.mockRestore())

describe('AI credentials and supported models', () => {
  test('the platform default never sends a browser credential and uses its own endpoint', async () => {
    mockReply()
    await requestAICompletion({ ...platformAIConfig, apiKey: 'must-not-be-forwarded' }, messages)
    expect(requests[0].url).toBe('/platform-ai-api/v1/chat/completions')
    expect(requests[0].headers.Authorization).toBeUndefined()
    expect(platformAIConfig.apiKey).toBeUndefined()
  })

  test('each allowed personal model uses its official proxy and the user credential', async () => {
    mockReply()
    for (const provider of aiProviders) {
      for (const model of provider.models) {
        await requestAICompletion({ provider: provider.id, model: model.id, baseUrl: provider.baseUrl, apiKey: ' personal-test-key ' }, messages, true)
        const request = requests.at(-1)
        expect(request.url).toBe(provider.id === 'openai' ? '/openai-api/v1/chat/completions' : '/deepseek-api/v1/chat/completions')
        expect(request.headers.Authorization).toBe('Bearer personal-test-key')
        expect(request.body.response_format).toEqual({ type: 'json_object' })
        expect(request.body.messages).toEqual(messages)
        expect(request.body.temperature).toBeUndefined()
        if (provider.id === 'deepseek') expect(request.body.thinking).toEqual({ type: 'disabled' })
        else expect(request.body.reasoning_effort).toBe('low')
      }
    }
  })

  test('rejects unsupported services, old models, custom endpoints and missing personal keys before sending', async () => {
    mockReply()
    const personal = { ...platformAIConfig, source: 'personal', apiKey: 'personal-test-key' }
    for (const change of [
      { provider: 'claude' }, { model: 'deepseek-chat' },
      { provider: 'openai', model: 'gpt-4o-mini' },
      { baseUrl: 'https://unrelated.example/v1' }, { apiKey: '' },
      { source: 'platform', model: 'deepseek-v4-pro' },
    ]) await expect(requestAICompletion({ ...personal, ...change }, messages)).rejects.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('connection checks and document generation both work with GPT', async () => {
    const config = { provider: 'openai', model: 'gpt-6.1-sol', baseUrl: 'https://api.openai.com/v1', apiKey: 'personal-test-key' }
    mockReply(JSON.stringify({ reply: '整理好了', document: '完成晚餐', expression: { mode: 'clear', markdown: '' }, details: { title: '晚餐', description: '', points: [], note: '' } }))
    await testAIConfig(config)
    const result = await generateAIDocument({ config, mode: 'action', hasParent: false, currentDocument: '', turns: messages })
    expect(result.document).toBe('完成晚餐')
    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.url === '/openai-api/v1/chat/completions')).toBe(true)
  })

  test('connection checks reject empty replies rather than reporting success', async () => {
    mockReply('')
    await expect(testAIConfig(platformAIConfig)).rejects.toThrow('AI 没有返回有效消息')
  })
})
