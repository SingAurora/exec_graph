import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { generateAIDocument } from './chat.ts'

const input = { mode: 'action', hasParent: true, currentDocument: '', inheritedExpression: '上次的表达', turns: [{ role: 'user', content: '做完了这顿饭，我更在意口感' }] }
let request
let fetchSpy
function respond(expression, agreementReviews) {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    request = JSON.parse(init.body)
    return new globalThis.Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      reply: '已经分别整理', document: '本次行动的事实', expression, agreementReviews,
      details: { title: '做饭', description: '完成一顿饭', points: [], note: '' },
    }) } }] }), { status: 200 })
  })
}
afterEach(() => { fetchSpy?.mockRestore(); fetchSpy = undefined })

describe('one action conversation with two documents', () => {
  test('returns both documents and supplies the current expression to the same dialogue', async () => {
    respond({ mode: 'update', markdown: '口感比速度更值得在意' })
    const result = await generateAIDocument({ ...input, currentExpression: { mode: 'inherit', markdown: '' }, historyFacts: [{ number: 2, authorId: 'lin', title: '先盛蛋', markdown: '鸡蛋边缘没有变硬' }] })
    expect(result.document).toBe('本次行动的事实')
    expect(result.expression).toEqual({ mode: 'update', markdown: '口感比速度更值得在意' })
    expect(request.messages.slice(1)).toEqual(input.turns)
    expect(request.messages[0].content).toContain('同一条连续对话')
    expect(request.messages[0].content).toContain('上次的表达')
    expect(request.messages[0].content).toContain('不要把聊天拆成两个阶段')
    expect(request.messages[0].content).toContain('鸡蛋边缘没有变硬')
    expect(request.messages[0].content).toContain('"authorId":"lin"')
  })

  test('keeps all prior turns when changing an expression within the action conversation', async () => {
    respond({ mode: 'clear', markdown: '' })
    const turns = [...input.turns, { role: 'assistant', content: '已经分别整理' }, { role: 'user', content: '这次先清空表达，保留行动' }]
    const result = await generateAIDocument({ ...input, turns, currentDocument: '本次行动的事实', currentExpression: { mode: 'update', markdown: '口感比速度更值得在意' } })
    expect(result.expression).toEqual({ mode: 'clear', markdown: '' })
    expect(request.messages.slice(1)).toEqual(turns)
    expect(request.messages[0].content).toContain('口感比速度更值得在意')
    expect(result.document).toBe('本次行动的事实')
  })

  test('preserves inheritance as a choice rather than rewriting the upstream document', async () => {
    respond({ mode: 'inherit', markdown: '' })
    expect((await generateAIDocument(input)).expression.mode).toBe('inherit')
    await expect(generateAIDocument({ ...input, hasParent: false })).rejects.toThrow('首次行动不能继承表达')
  })

  test('rejects incomplete or inconsistent expression responses', async () => {
    for (const expression of [undefined, { mode: 'update', markdown: '' }, { mode: 'clear', markdown: '不能同时有内容' }, { mode: 'unknown', markdown: '' }]) {
      respond(expression)
      await expect(generateAIDocument(input)).rejects.toThrow('表达格式不完整')
      fetchSpy.mockRestore()
    }
  })

  test('returns a source-specific mismatch without blocking document generation or requiring approval', async () => {
    respond({ mode: 'inherit', markdown: '' }, [{ nodeNumber: 2, complies: false, reason: '未做十分钟静置' }])
    const result = await generateAIDocument({ ...input, sourceAgreements: [{ nodeNumber: 2, markdown: '静置十分钟再观察' }], downstreamAgreement: '' })
    expect(result.agreementReviews).toEqual([{ nodeNumber: 2, complies: false, reason: '未做十分钟静置' }])
    expect(result.document).toBe('本次行动的事实')
    expect(request.messages[0].content).toContain('不符合不阻止发布，无需申请同意')
    expect(request.messages[0].content).toContain('缺少信息或尚未核对时为 null')
  })

  test('a response without an assessment stays unknown and an unrelated assessment is rejected', async () => {
    respond({ mode: 'inherit', markdown: '' })
    const withSource = { ...input, sourceAgreements: [{ nodeNumber: 2, markdown: '静置十分钟再观察' }] }
    expect((await generateAIDocument(withSource)).agreementReviews).toEqual([{ nodeNumber: 2, complies: null, reason: '' }])
    fetchSpy.mockRestore()
    respond({ mode: 'inherit', markdown: '' }, [{ nodeNumber: 99, complies: true, reason: '' }])
    await expect(generateAIDocument(withSource)).rejects.toThrow('与引用来源不一致')
  })

  test('sends merged history and separately assesses all direct agreements without assuming missing results are satisfied', async () => {
    respond({ mode: 'inherit', markdown: '' }, [
      { nodeNumber: 2, complies: true, reason: '锅温有记录' },
      { nodeNumber: 7, complies: false, reason: '没有静置十分钟' },
    ])
    const result = await generateAIDocument({ ...input,
      sourceAgreements: [{ nodeNumber: 2, markdown: '记录锅温' }, { nodeNumber: 7, markdown: '静置十分钟' }, { nodeNumber: 11, markdown: '记录用时' }],
      historyFacts: [{ number: 7, authorId: 'miao', title: '放凉观察', markdown: '合入的行动事实' }],
    })
    expect(result.agreementReviews).toEqual([
      { nodeNumber: 2, complies: true, reason: '锅温有记录' },
      { nodeNumber: 7, complies: false, reason: '没有静置十分钟' },
      { nodeNumber: 11, complies: null, reason: '' },
    ])
    expect(request.messages[0].content).toContain('节点 #7：\n静置十分钟')
    expect(request.messages[0].content).toContain('合入的行动事实')
  })
})
