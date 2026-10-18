import { describe, expect, test } from 'bun:test'
import { getActionExpression, getActionExpressionNodes, sortActionsNewestFirst } from './expressions.ts'

function node(id, parentId, expressionMarkdown, extra = {}) {
  return { id, projectId: 'graph', number: Number(id) || 1, parentId, expressionMarkdown, authorId: id, title: id, markdown: '事实不是表达', images: [], conversation: [], createdAt: `2026-10-${id.padStart(2, '0')}T12:00:00+08:00`, ...extra }
}

describe('effective action expressions', () => {
  test('inherits through multiple nodes and preserves the original author and source', () => {
    const root = node('1', undefined, '原有观点', { authorId: 'original-author' })
    const actions = [root, node('2', '1'), node('3', '2')]
    expect(getActionExpression(actions, '3')).toEqual({ markdown: '原有观点', sourceNode: root })
    const updated = node('4', '3', '新的观点')
    expect(getActionExpression([...actions, updated], '4')).toEqual({ markdown: '新的观点', sourceNode: updated })
  })

  test('explicit clearing stops inheritance until a later explicit update', () => {
    const cleared = node('2', '1', '')
    const actions = [node('1', undefined, '旧观点'), cleared, node('3', '2')]
    expect(getActionExpression(actions, '3')).toEqual({ markdown: '', sourceNode: cleared })
    const updated = node('4', '3', '重新形成观点')
    expect(getActionExpression([...actions, updated], '4').markdown).toBe('重新形成观点')
    expect(getActionExpression([node('1')], '1')).toEqual({ markdown: '' })
  })

  test('merges do not override the primary expression, even if it is empty', () => {
    const merged = node('2', undefined, '合入来源的观点')
    const actions = [node('1'), merged, node('3', '1', undefined, { mergedParentIds: ['2'] })]
    expect(getActionExpression(actions, '3')).toEqual({ markdown: '' })
    actions[0] = node('1', undefined, '主承接观点')
    expect(getActionExpression(actions, '3').markdown).toBe('主承接观点')
    actions[0] = node('1', undefined, '')
    expect(getActionExpression(actions, '3').sourceNode.id).toBe('1')
    expect(getActionExpression(actions, '3').markdown).toBe('')
  })

  test('does not borrow facts or unrelated expressions across missing sources, graphs, or cycles', () => {
    expect(getActionExpression([node('1', 'missing'), node('2', undefined, '无关观点')], '1')).toEqual({ markdown: '' })
    expect(getActionExpression([node('1', '2'), node('2', undefined, '其他图', { projectId: 'other' })], '1')).toEqual({ markdown: '' })
    expect(getActionExpression([node('1', '2'), node('2', '1')], '1')).toEqual({ markdown: '' })
    expect(getActionExpression([], 'missing')).toEqual({ markdown: '' })
  })
})

describe('expression and fact lists', () => {
  test('moves a route to its new endpoint while keeping other branches separate', () => {
    const actions = [node('1'), node('2', '1'), node('3', '1'), node('4', '2')]
    expect(getActionExpressionNodes(actions).map((item) => item.id)).toEqual(['4', '3'])
    expect(getActionExpressionNodes([...actions, node('5', '4', undefined, { mergedParentIds: ['3'] })]).map((item) => item.id)).toEqual(['5'])
    expect(getActionExpressionNodes([node('1')]).map((item) => item.id)).toEqual(['1'])
    expect(getActionExpressionNodes([])).toEqual([])
  })

  test('sorts by publication time rather than node number, without mutating facts', () => {
    const actions = [node('1', undefined, '', { createdAt: '2026-10-18T12:00:00+08:00' }), node('2', '1')]
    expect(sortActionsNewestFirst(actions).map((item) => item.id)).toEqual(['1', '2'])
    expect(actions.map((item) => item.id)).toEqual(['1', '2'])
    expect(sortActionsNewestFirst(actions)).toHaveLength(2)
  })
})
