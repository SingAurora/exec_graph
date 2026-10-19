import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { generateAIDocument } from './chat.ts'

const config = { provider: 'deepseek', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'test-personal-key' }
let request
let fetchSpy
const response = (document) => {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    request = JSON.parse(init.body)
    return new globalThis.Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      reply: '已根据对话调整', document, details: { title: '观点', description: '', points: [], note: '' },
    }) } }] }), { status: 200 })
  })
}
afterEach(() => { fetchSpy?.mockRestore(); fetchSpy = undefined })

describe('expression generation requests', () => {
  const input = { config, mode: 'expression', currentDocument: '已有的表达', contextGuide: '保留个人偏好',
    expressionContext: { nodeNumber: 3, facts: [{ number: 1, authorId: 'lin', title: '第一次炒菜', markdown: '鸡蛋边缘偏硬' }, { number: 3, authorId: 'jo', title: '复做', markdown: '先盛蛋后没有硬边' }] },
    sourceAgreements: [{ nodeNumber: 1, markdown: '说明锅具' }], downstreamAgreement: '记录用时',
    turns: [{ role: 'user', content: '原行动说明' }, { role: 'assistant', content: '原行动回复' }, { role: 'user', content: '只说明我的取舍' }],
  }
  test('uses the original continuous dialogue, known facts, effective document and source agreements', async () => {
    response('整理后的表达')
    const result = await generateAIDocument(input)
    expect(result.document).toBe('整理后的表达')
    expect(request.messages.slice(1)).toEqual(input.turns)
    const prompt = request.messages[0].content
    for (const text of ['节点 #3', '鸡蛋边缘偏硬', '先盛蛋后没有硬边', '已有的表达', '说明锅具', '保留个人偏好', '不是记录新行动', '没有引用的其他分支不属于背景']) expect(prompt).toContain(text)
  })
  test('permits an explicit empty expression while ordinary action generation still requires a document', async () => {
    response('')
    expect((await generateAIDocument({ ...input, turns: [{ role: 'user', content: '请清空表达' }] })).document).toBe('')
    await expect(generateAIDocument({ config, mode: 'action', currentDocument: '', turns: [] })).rejects.toThrow('缺少必要内容')
  })
  test('does not send an expression request without its action background', async () => {
    response('不应调用')
    await expect(generateAIDocument({ ...input, expressionContext: undefined })).rejects.toThrow('缺少表达的行动背景')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
