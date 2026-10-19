import { describe, expect, test } from 'bun:test'
import { getActionExpressionContext } from './expression-context.ts'
import { updateActionExpressionFromConversation } from './expressions.ts'

const node = (number, extra = {}) => ({ id: String(number), number, projectId: 'graph', authorId: 'jo', title: `行动 ${number}`, markdown: `事实 ${number}`, conversation: [], ...extra })
const editor = { authorId: 'lin', createdAt: '2026-10-18T12:00:00+08:00' }
const conversation = [
  { id: 'expression-user', speaker: 'user', body: '保留个人偏好，不推断别人', authorId: 'lin' },
  { id: 'expression-ai', speaker: 'ai', body: '已调整表达' },
]

describe('expression dialogue context and confirmation', () => {
  test('includes current and all cited facts once, excluding unrelated branches and cross-graph references', () => {
    const nodes = [node(1), node(2, { parentId: '1', expressionMarkdown: '看法不是事实' }), node(3, { parentId: '1' }),
      node(4, { parentId: '2', mergedParentIds: ['3', '99'], objectiveMarkdown: '本次事实', markdown: '旧版兼容正文' }),
      node(5, { parentId: '1' }), node(99, { projectId: 'other' })]
    const context = getActionExpressionContext(nodes, '4')
    expect(context.nodeNumber).toBe(4)
    expect(context.facts.map((fact) => fact.number)).toEqual([1, 2, 3, 4])
    expect(context.facts[3].markdown).toBe('本次事实')
    expect(JSON.stringify(context)).not.toContain('看法不是事实')
    expect(getActionExpressionContext(nodes, 'missing')).toBeUndefined()
  })

  test('saves AI expression dialogue separately, preserving source, facts, agreements and original dialogue', () => {
    const original = [{ id: 'original', speaker: 'user', body: '这次实际发生的事情' }]
    const nodes = [node(1, { expressionMarkdown: '上游表达' }), node(2, { parentId: '1', agreementMarkdown: '记录用时', conversation: original })]
    const updated = updateActionExpressionFromConversation(nodes, '2', '新的表达', editor, conversation)
    expect(updated).toHaveLength(2)
    expect(updated[0]).toBe(nodes[0])
    expect(updated[1].expressionMarkdown).toBe('新的表达')
    expect(updated[1].expressionConversation).toEqual(conversation)
    expect(updated[1].conversation).toBe(original)
    expect(updated[1].markdown).toBe(nodes[1].markdown)
    expect(updated[1].agreementMarkdown).toBe('记录用时')
    expect(updated[1].expressionSupplement).toEqual({ ...editor, kind: 'modify' })
    expect(nodes[1].expressionConversation).toBeUndefined()
    const cleared = updateActionExpressionFromConversation(updated, '2', '', editor, conversation)
    expect(cleared[1].expressionMarkdown).toBe('')
    expect(cleared[1].expressionSupplement.kind).toBe('clear')
  })

  test('rejects absent or failed generation and nodes that have gained either kind of reference', () => {
    const nodes = [node(1, { expressionMarkdown: '原表达' })]
    for (const turns of [[], conversation.slice(0, 1), [{ id: 'error-failure', speaker: 'ai', body: '失败' }]]) {
      expect(updateActionExpressionFromConversation(nodes, '1', '新表达', editor, turns)).toBe(nodes)
    }
    for (const extra of [{ parentId: '1' }, { mergedParentIds: ['1'] }]) {
      const referenced = [...nodes, node(2, extra)]
      expect(updateActionExpressionFromConversation(referenced, '1', '新表达', editor, conversation)).toBe(referenced)
    }
  })
})
