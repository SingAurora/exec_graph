import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { requestAICompletion } from './completion.ts'
import { generateAIDocument } from './chat.ts'

let fetchSpy
let requests
const messages = [{ role: 'user', content: '我做完了一顿饭' }]
function mockReply(content = '整理好了', status = 200) {
  requests = []
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    return new globalThis.Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : { error: { message: content } }), { status })
  })
}
afterEach(() => fetchSpy?.mockRestore())

describe('platform AI completion', () => {
  test('uses the platform default without sending any browser credential', async () => {
    mockReply()
    await requestAICompletion(messages)
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/platform-ai-api/v1/chat/completions')
    expect(requests[0].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(requests[0].body).toEqual({ model: 'deepseek-flash', messages, thinking: { type: 'disabled' } })
  })

  test('requests structured output through the same platform service', async () => {
    mockReply()
    await requestAICompletion(messages, true)
    expect(requests[0].body.response_format).toEqual({ type: 'json_object' })
    expect(requests[0].body.messages).toEqual(messages)
  })

  test('document generation needs no user configuration', async () => {
    mockReply(JSON.stringify({ reply: '整理好了', document: '完成晚餐', expression: { mode: 'clear', markdown: '' }, details: { title: '晚餐', description: '', points: [], note: '' } }))
    const result = await generateAIDocument({ mode: 'action', hasParent: false, currentDocument: '', turns: messages })
    expect(result.document).toBe('完成晚餐')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/platform-ai-api/v1/chat/completions')
    expect(requests[0].headers.Authorization).toBeUndefined()
    expect(requests[0].body.response_format).toEqual({ type: 'json_object' })
  })

  test('platform failures propagate without falling back to another provider', async () => {
    mockReply('平台 AI 暂不可用', 503)
    await expect(requestAICompletion(messages)).rejects.toThrow('平台 AI 暂不可用')
    expect(requests).toHaveLength(1)
  })

  test('empty model output remains an error', async () => {
    mockReply('')
    await expect(generateAIDocument({ mode: 'action', currentDocument: '', turns: messages })).rejects.toThrow('AI 没有返回可用内容')
  })
})
