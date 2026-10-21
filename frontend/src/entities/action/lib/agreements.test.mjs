import { describe, expect, test } from 'bun:test'
import { canEditActionAgreement, getActionAgreement, getActionAgreementOrigin, updateActionAgreement } from './agreements.ts'
import { getActionReferences } from './references.ts'

const node = (id, extra = {}) => ({ id, projectId: 'graph', number: Number(id), authorId: 'jo', ...extra })

describe('agreement versions along a continuation', () => {
  test('inherits over multiple authors and unchanged nodes, then revises without rewriting earlier versions', () => {
    const nodes = [node('1', { agreementMarkdown: '记录用时' }), node('2', { parentId: '1', authorId: 'lin' }), node('3', { parentId: '2' }),
      node('4', { parentId: '3', agreementMarkdown: '记录用时和锅具' }), node('5', { parentId: '4' })]
    expect(getActionAgreement(nodes, '3')).toEqual({ markdown: '记录用时', sourceNode: nodes[0] })
    expect(getActionAgreementOrigin(nodes, '3')).toEqual({ kind: 'inherited', node: nodes[0] })
    expect(getActionAgreementOrigin(nodes, '4')).toEqual({ kind: 'modified', node: nodes[0] })
    expect(getActionAgreement(nodes, '5')).toEqual({ markdown: '记录用时和锅具', sourceNode: nodes[3] })
    expect(getActionAgreement(nodes, '2').markdown).toBe('记录用时')
    expect(nodes[1].agreementMarkdown).toBeUndefined()
  })

  test('explicit clears propagate until a new agreement is written and do not fall back to merged conditions', () => {
    const nodes = [node('1', { agreementMarkdown: '旧约定' }), node('2', { parentId: '1', agreementMarkdown: '' }),
      node('3', { parentId: '2', mergedParentIds: ['1'] }), node('4', { parentId: '3', agreementMarkdown: '重新设置' })]
    expect(getActionAgreement(nodes, '3')).toEqual({ markdown: '', sourceNode: nodes[1] })
    expect(getActionAgreementOrigin(nodes, '3')).toBeUndefined()
    expect(getActionAgreementOrigin(nodes, '4')).toBeUndefined()
    expect(getActionAgreement(nodes, '4').markdown).toBe('重新设置')
    expect(getActionAgreement(nodes, '1').markdown).toBe('旧约定')
  })

  test('empty roots, whitespace clears, broken references, cycles and cross-graph parents remain safe', () => {
    expect(getActionAgreement([node('1')], '1')).toEqual({ markdown: '' })
    expect(getActionAgreement([], 'missing')).toEqual({ markdown: '' })
    expect(getActionAgreement([node('1', { parentId: '2' }), node('2', { parentId: '1' })], '1')).toEqual({ markdown: '' })
    expect(getActionAgreement([node('1', { parentId: '2' }), node('2', { projectId: 'other', agreementMarkdown: '其他图' })], '1')).toEqual({ markdown: '' })
    expect(getActionAgreement([node('1', { parentId: 'missing' })], '1')).toEqual({ markdown: '' })
    expect(getActionAgreement([node('1', { agreementMarkdown: '旧约定' }), node('2', { parentId: '1', agreementMarkdown: '  ' })], '2').markdown.trim()).toBe('')
  })

  test('checks the inherited source version even when the target replaces or clears its downstream agreement', () => {
    const nodes = [node('1', { agreementMarkdown: '十分钟观察' }), node('2', { parentId: '1', authorId: 'lin' }),
      node('3', { parentId: '2', agreementMarkdown: '', referenceAgreements: [{ sourceId: '2', complies: false }] }),
      node('4', { parentId: '3' }), node('5', { parentId: '2', agreementMarkdown: '只记录热时' })]
    const references = getActionReferences(nodes)
    const incoming = references.find((reference) => reference.target.id === '3')
    expect(incoming.agreement.markdown).toBe('十分钟观察')
    expect(incoming.agreement.sourceNode.id).toBe('1')
    expect(incoming.agreementStatus).toBe('exception')
    expect(incoming).not.toHaveProperty('authorization')
    expect(references.find((reference) => reference.target.id === '4').agreementStatus).toBe('unrestricted')
    expect(references.find((reference) => reference.target.id === '5').agreementStatus).toBe('unreviewed')
  })
})

describe('editing an endpoint agreement', () => {
  const supplement = { authorId: 'jo', createdAt: '2026-10-18T15:00:00+08:00' }

  test('allows empty or inherited endpoints and rejects both kinds of downstream references', () => {
    const root = node('1', { agreementMarkdown: '已有约定' })
    const inherited = node('2', { parentId: '1' })
    const cleared = node('3', { parentId: '1', agreementMarkdown: '' })
    expect(canEditActionAgreement([root, inherited], '2')).toBe(true)
    expect(canEditActionAgreement([root, cleared], '3')).toBe(true)
    expect(canEditActionAgreement([node('1')], '1')).toBe(true)
    expect(canEditActionAgreement([node('1')], 'missing')).toBe(false)
    expect(canEditActionAgreement([node('1'), node('2', { parentId: '1' })], '1')).toBe(false)
    const merge = node('2', { mergedParentIds: ['1'] })
    expect(canEditActionAgreement([node('1'), merge], '1')).toBe(false)
    expect(canEditActionAgreement([node('1'), { ...merge, projectId: 'other' }], '1')).toBe(true)
  })

  test('saves on the same node without changing expression, facts, conversation or incoming agreement handling', () => {
    const root = node('1', { agreementMarkdown: '来源要求' })
    const target = node('2', { parentId: '1', agreementMarkdown: '', expressionMarkdown: '已有表达', markdown: '行动事实',
      conversation: [{ id: 'original', speaker: 'user', body: '原始对话' }], referenceAgreements: [{ sourceId: '1', complies: true }] })
    const actions = [root, target]
    const updated = updateActionAgreement(actions, '2', '  后续记录用时  ', supplement)
    expect(updated).toHaveLength(2)
    expect(updated[0]).toBe(root)
    expect(updated[1]).toEqual({ ...target, agreementMarkdown: '后续记录用时', agreementSupplement: { ...supplement, kind: 'supplement' } })
    expect(updated[1].conversation).toBe(target.conversation)
    expect(target.agreementMarkdown).toBe('')
    expect(getActionReferences(updated)[0].agreementStatus).toBe('satisfied')
    expect(canEditActionAgreement(updated, '2')).toBe(true)
    expect(getActionAgreement([...updated, node('3', { parentId: '2' })], '3').markdown).toBe('后续记录用时')
  })

  test('modifies or clears inherited conditions without changing the source or its assessment', () => {
    const root = node('1', { agreementMarkdown: '记录用时' })
    const target = node('2', { parentId: '1', referenceAgreements: [{ sourceId: '1', complies: true }] })
    const actions = [root, target]
    const modified = updateActionAgreement(actions, '2', '记录用时和锅具', supplement)
    expect(modified[1].agreementSupplement.kind).toBe('modify')
    expect(getActionAgreementOrigin(modified, '2')).toEqual({ kind: 'modified', node: root })
    const again = updateActionAgreement(modified, '2', '只记录锅具', supplement)
    expect(again[1].agreementMarkdown).toBe('只记录锅具')
    for (const before of [actions, again]) {
      const cleared = updateActionAgreement(before, '2', '', supplement)
      expect(cleared[1].agreementMarkdown).toBe('')
      expect(cleared[1].agreementSupplement.kind).toBe('clear')
      expect(cleared[0]).toBe(root)
      expect(getActionReferences(cleared)[0].agreementStatus).toBe('satisfied')
      expect(getActionAgreement([...cleared, node('3', { parentId: '2' })], '3').markdown).toBe('')
      expect(updateActionAgreement(cleared, '2', '新约定', supplement)[1].agreementSupplement.kind).toBe('supplement')
    }
    expect(target.agreementMarkdown).toBeUndefined()
    expect(root.agreementMarkdown).toBe('记录用时')
  })

  test('rejects no-op edits, missing nodes and a successor added while editing', () => {
    const actions = [node('1'), node('2', { agreementMarkdown: '已有约定' })]
    expect(updateActionAgreement(actions, '1', '  ', supplement)).toBe(actions)
    expect(updateActionAgreement(actions, '2', ' 已有约定 ', supplement)).toBe(actions)
    expect(updateActionAgreement(actions, 'missing', '补充', supplement)).toBe(actions)
    for (const extra of [{ parentId: '2' }, { mergedParentIds: ['2'] }]) {
      const continued = [...actions, node('3', extra)]
      expect(updateActionAgreement(continued, '2', '修改', supplement)).toBe(continued)
      expect(updateActionAgreement(continued, '2', '', supplement)).toBe(continued)
    }
  })
})
