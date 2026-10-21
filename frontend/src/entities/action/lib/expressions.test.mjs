import { describe, expect, test } from 'bun:test'
import { canEditActionExpression, getActionExpression, getActionExpressionNodes, getActionExpressionOrigin, sortActionsNewestFirst, updateActionExpression } from './expressions.ts'

function node(id, parentId, expressionMarkdown, extra = {}) {
  return { id, projectId: 'graph', number: Number(id) || 1, parentId, expressionMarkdown, authorId: id, title: id, markdown: '事实不是表达', images: [], conversation: [], createdAt: `2026-10-${id.padStart(2, '0')}T12:00:00+08:00`, ...extra }
}

const supplement = { authorId: 'jo', createdAt: '2026-10-18T15:00:00+08:00' }

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

describe('expression origin', () => {
  test('both inheritance and modification point to the actual document, skipping intermediates', () => {
    const original = node('1', undefined, '原表达')
    const actions = [original, node('2', '1'), node('3', '2'), node('4', '3', '更新的表达')]
    expect(getActionExpressionOrigin(actions, '3')).toEqual({ kind: 'inherited', node: original })
    expect(getActionExpressionOrigin(actions, '4')).toEqual({ kind: 'modified', node: original })
    expect(getActionExpressionOrigin(actions, '1')).toBeUndefined()
  })

  test('empty expressions and first writes after clearing have no invented origin', () => {
    const actions = [node('1', undefined, '旧表达'), node('2', '1', ''), node('3', '2'), node('4', '3', '首次重新写入')]
    for (const id of ['2', '3', '4', 'missing']) expect(getActionExpressionOrigin(actions, id)).toBeUndefined()
    expect(getActionExpressionOrigin([node('1', '1', '表达')], '1')).toBeUndefined()
  })
})

describe('editing an endpoint expression', () => {
  test('all endpoints qualify, including existing expressions and an isolated root', () => {
    const actions = [node('1', undefined, ''), node('2', '1'), node('3', undefined, '已有表达')]
    expect(canEditActionExpression(actions, '1')).toBe(false)
    expect(canEditActionExpression(actions, '2')).toBe(true)
    expect(canEditActionExpression(actions, '3')).toBe(true)
    expect(canEditActionExpression(actions, 'missing')).toBe(false)
    expect(canEditActionExpression([node('1')], '1')).toBe(true)
  })

  test('a merge also ends eligibility, while references from another graph do not', () => {
    const empty = node('1', undefined, '')
    const merge = node('2', undefined, undefined, { mergedParentIds: ['1'] })
    expect(canEditActionExpression([empty, merge], '1')).toBe(false)
    expect(canEditActionExpression([empty, { ...merge, projectId: 'other' }], '1')).toBe(true)
    expect(canEditActionExpression([node('1', undefined, '上游表达'), node('2', '1')], '2')).toBe(true)
  })

  test('saving changes only the current expression without creating another action or mutating facts', () => {
    const actions = [node('1', undefined, ''), node('2', '1')]
    const updated = updateActionExpression(actions, '2', '  新的表达  ', supplement)
    expect(updated).toHaveLength(actions.length)
    expect(updated[0]).toBe(actions[0])
    expect(updated[1]).toEqual({ ...actions[1], expressionMarkdown: '新的表达', expressionSupplement: { ...supplement, kind: 'supplement' } })
    expect(actions[1].expressionMarkdown).toBeUndefined()
    expect(getActionExpression(updated, '2').markdown).toBe('新的表达')
    expect(canEditActionExpression(updated, '2')).toBe(true)
  })

  test('revises inherited content locally, permits repeated edits and explicitly clears inheritance', () => {
    const actions = [node('1', undefined, '上游观点'), node('2', '1')]
    const revised = updateActionExpression(actions, '2', '  修订后的观点  ', supplement)
    expect(revised[0]).toBe(actions[0])
    expect(revised[1].expressionSupplement.kind).toBe('modify')
    expect(getActionExpressionOrigin(revised, '2')).toEqual({ kind: 'modified', node: actions[0] })
    const editedAgain = updateActionExpression(revised, '2', '再修订', supplement)
    expect(getActionExpression(editedAgain, '2').markdown).toBe('再修订')
    const cleared = updateActionExpression(editedAgain, '2', '', supplement)
    expect(cleared[1].expressionMarkdown).toBe('')
    expect(cleared[1].expressionSupplement.kind).toBe('clear')
    expect(getActionExpression([...cleared, node('3', '2')], '3').markdown).toBe('')
    const supplemented = updateActionExpression(cleared, '2', '重新写下观点', supplement)
    expect(supplemented[1].expressionSupplement.kind).toBe('supplement')
    expect(getActionExpression(supplemented, '2').markdown).toBe('重新写下观点')
    expect(actions[1].expressionMarkdown).toBeUndefined()
    const clearedInherited = updateActionExpression(actions, '2', '', supplement)
    expect(getActionExpression(clearedInherited, '2').markdown).toBe('')
    expect(clearedInherited[0].expressionMarkdown).toBe('上游观点')
  })

  test('rejects no-op edits, missing nodes and either reference added while editing', () => {
    const actions = [node('1', undefined, ''), node('2', '1', ''), node('3', undefined, '已有表达')]
    expect(updateActionExpression(actions, '2', '  ', supplement)).toBe(actions)
    expect(updateActionExpression(actions, '1', '补充', supplement)).toBe(actions)
    expect(updateActionExpression(actions, '3', ' 已有表达 ', supplement)).toBe(actions)
    expect(updateActionExpression(actions, 'missing', '补充', supplement)).toBe(actions)
    for (const extra of [{ parentId: '3' }, { mergedParentIds: ['3'] }]) {
      const continued = [...actions, node('4', undefined, undefined, extra)]
      expect(updateActionExpression(continued, '3', '修改', supplement)).toBe(continued)
      expect(updateActionExpression(continued, '3', '', supplement)).toBe(continued)
    }
  })
})
