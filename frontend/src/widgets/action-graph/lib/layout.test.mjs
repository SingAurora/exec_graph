import { describe, expect, test } from 'bun:test'
import { getActionContextIds, getActionParentUuids, getAncestors } from '../../../entities/action/lib/graph.ts'
import { getActionReferences } from '../../../entities/action/lib/references.ts'
import { getActionLevels } from '../../../entities/action/lib/levels.ts'
import { createActionLayout, GRAPH_WIDTH } from './layout.ts'

const node = (uuid, extra = {}) => ({ uuid, id: uuid, graphUuid: 'graph', number: Number(uuid.replace(/\D/g, '')) || 1,
  authorUuid: 'a', title: uuid, markdown: '行动', images: [], conversation: [], createdAt: '2026-10-20T12:00:00+08:00', ...extra })
const actions = [
  node('1', { agreementMarkdown: '记录' }),
  node('2', { parentUuid: '1', authorUuid: 'b' }),
  node('3', { parentUuid: '1', authorUuid: 'a', referenceAgreements: [{ sourceUuid: '1', complies: false, exceptionReason: '没有记录' }] }),
  node('4', { parentUuid: '2', mergedParentUuids: ['3'] }),
]

describe('action graph reference semantics', () => {
  test('separates authorship from continuation and agreement exceptions', () => {
    const references = getActionReferences(actions)
    expect(references.find((edge) => edge.uuid === '1:2').sameAuthor).toBe(false)
    expect(references.find((edge) => edge.uuid === '1:3').sameAuthor).toBe(true)
    expect(references.find((edge) => edge.uuid === '1:3').agreementStatus).toBe('exception')
    const layout = createActionLayout(actions, [])
    expect(layout.elements.find((element) => element.data.id === '1:3').classes.split(' ')).toContain('exception')
    expect(layout.elements.find((element) => element.data.id === '1:2').classes.split(' ')).toContain('other-author')
  })

  test('includes only cited histories', () => {
    expect([...getActionContextIds(actions, '4')].sort()).toEqual(['1', '2', '3', '4'])
    expect([...getActionContextIds(actions, '2')].sort()).toEqual(['1', '2'])
    expect(getActionParentUuids({ ...actions[3], mergedParentUuids: ['1', '2'] })).toEqual(['2', '1'])
    expect(getActionReferences([{ ...actions[0], graphUuid: 'other' }, actions[1]])).toHaveLength(0)
  })

  test('uses depth from one and keeps geometry independent of emphasis', () => {
    const levels = getActionLevels(actions)
    expect(levels.get('1')).toBe(1)
    expect(levels.get('2')).toBe(2)
    expect(levels.get('3')).toBe(2)
    expect(levels.get('4')).toBe(3)
    const neutral = createActionLayout(actions, [])
    const highlighted = createActionLayout(actions, getAncestors(actions, '4'))
    expect([...neutral.positions]).toEqual([...highlighted.positions])
    for (const position of neutral.positions.values()) {
      expect(position.x).toBeGreaterThanOrEqual(40)
      expect(position.x).toBeLessThanOrEqual(GRAPH_WIDTH - 40)
    }
  })

  test('rejects cycles and grows long chains vertically', () => {
    const a = node('a', { parentUuid: 'b' })
    const b = node('b', { parentUuid: 'a' })
    expect(() => getActionLevels([a, b])).toThrow('行动引用关系存在循环')
    const chain = Array.from({ length: 100 }, (_, index) => node(String(index + 1), { parentUuid: index ? String(index) : undefined }))
    const layout = createActionLayout(chain, chain)
    expect(layout.height).toBeGreaterThan(8000)
    expect(layout.levels.get('100')).toBe(100)
    expect(createActionLayout([], []).positions.size).toBe(0)
  })
})
