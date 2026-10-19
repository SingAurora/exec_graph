import { describe, expect, test } from 'bun:test'
import { buildActionAgreementContext } from './action-agreement-context.ts'

describe('agreement instructions for the action conversation', () => {
  test('keeps incoming conditions even when the author clears downstream conditions', () => {
    const prompt = buildActionAgreementContext([{ nodeNumber: 8, markdown: '记录完整用时' }], '')
    expect(prompt).toContain('节点 #8：\n记录完整用时')
    expect(prompt).toContain('本节点向后传递的约定：\n无约定')
    expect(prompt).toContain('不会替代或取消本次引用的来源约定')
    expect(prompt).toContain('不得为了满足约定编造行动事实')
    expect(prompt).toContain('没有核对不能宣称满足')
    expect(prompt).toContain('不满足约定仍可引用')
    expect(prompt).toContain('标记 ×，无需申请或等待来源作者同意')
  })

  test('keeps each direct source independent and omits empty incoming conditions', () => {
    const prompt = buildActionAgreementContext([{ nodeNumber: 1, markdown: '' }, { nodeNumber: 2, markdown: '说明锅具' }, { nodeNumber: 3, markdown: '说明食用状态' }], '后续记录吃法')
    expect(prompt).not.toContain('节点 #1')
    expect(prompt).toContain('节点 #2：\n说明锅具')
    expect(prompt).toContain('节点 #3：\n说明食用状态')
    expect(prompt).toContain('后续记录吃法')
    expect(buildActionAgreementContext()).toBe('')
  })
})
