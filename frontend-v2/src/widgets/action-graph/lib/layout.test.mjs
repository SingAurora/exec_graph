import { describe, expect, test } from 'bun:test'
import { demoActions } from '../../../app/demo/actions.ts'
import { getActionContextIds, getActionParentIds, getAncestors, getPreferredPath } from '../../../entities/action/lib/graph.ts'
import { getActionReferences } from '../../../entities/action/lib/references.ts'
import { getActionLevels } from '../../../entities/action/lib/levels.ts'
import { createActionLayout, GRAPH_WIDTH } from './layout.ts'

const actions = demoActions.filter((node) => node.projectId === 'cooking')
const mainPath = getPreferredPath(actions)

describe('action graph reference semantics', () => {
  test('separates authorship from continuation and incorporation', () => {
    const references = getActionReferences(actions)
    expect(references).toHaveLength(19)
    expect(references.find((edge) => edge.id === 'cooking-10:cooking-13').sameAuthor).toBe(true)
    expect(references.find((edge) => edge.id === 'cooking-4:cooking-13').sameAuthor).toBe(true)
    expect(references.find((edge) => edge.id === 'cooking-1:cooking-2').sameAuthor).toBe(false)
    expect(references.filter((edge) => edge.incorporated).map((edge) => edge.id).sort())
      .toEqual(['cooking-4:cooking-13', 'cooking-7:cooking-14'])
  })

  test('preserves exception crosses after self or source-author approval', () => {
    const references = getActionReferences(actions)
    expect(references.find((edge) => edge.id === 'cooking-10:cooking-13'))
      .toMatchObject({ sameAuthor: true, agreementStatus: 'exception', authorization: 'self-approved' })
    expect(references.find((edge) => edge.id === 'cooking-3:cooking-6'))
      .toMatchObject({ sameAuthor: false, agreementStatus: 'exception', authorization: 'author-approved' })
    expect(references.find((edge) => edge.id === 'cooking-4:cooking-13'))
      .toMatchObject({ sameAuthor: true, agreementStatus: 'satisfied', authorization: 'not-required' })
    expect(references.find((edge) => edge.id === 'cooking-4:cooking-7'))
      .toMatchObject({ sameAuthor: false, agreementStatus: 'satisfied', authorization: 'not-required' })
  })

  test('does not invent compliance or accept approval from a third party', () => {
    const source = actions.find((node) => node.id === 'cooking-3')
    const target = actions.find((node) => node.id === 'cooking-6')
    expect(getActionReferences([source, { ...target, referenceAgreements: [] }])[0].agreementStatus).toBe('unreviewed')
    const referenceAgreements = [{ sourceId: source.id, complies: false, approvedById: 'jo' }]
    expect(getActionReferences([source, { ...target, referenceAgreements }])[0].authorization).toBe('pending')
  })

  test('includes all referenced histories while excluding unrelated branches', () => {
    expect([...getActionContextIds(actions, 'cooking-13')].sort()).toEqual([
      'cooking-1', 'cooking-10', 'cooking-13', 'cooking-2', 'cooking-4', 'cooking-5', 'cooking-8', 'cooking-9',
    ])
    expect(actions.find((node) => node.id === 'cooking-13').contextSnapshot.historyNodeCount).toBe(7)
    expect(actions.find((node) => node.id === 'cooking-14').contextSnapshot.historyNodeCount).toBe(8)
    const partial = [{ ...actions[0], parentId: 'missing', mergedParentIds: ['cooking-2'] }, actions[1]]
    expect([...getActionContextIds(partial, 'cooking-2')].sort()).toEqual(['cooking-1', 'cooking-2'])
    expect(getActionParentIds({ ...actions[1], mergedParentIds: ['cooking-1', 'cooking-2'] })).toEqual(['cooking-1'])
    expect(getActionReferences([{ ...actions[0], projectId: 'other' }, actions[1]])).toHaveLength(0)
  })
})

describe('fixed-width vertical layout', () => {
  test('clearing route emphasis preserves geometry, authorship and agreement exceptions', () => {
    const highlighted = createActionLayout(actions, getAncestors(actions, 'cooking-13'))
    const neutral = createActionLayout(actions, [])
    expect([...neutral.positions]).toEqual([...highlighted.positions])
    expect(neutral.height).toBe(highlighted.height)
    expect(neutral.elements.every((element) => !element.classes.split(' ').some((name) => name === 'main' || name === 'context'))).toBe(true)
    const edge = neutral.elements.find((element) => element.data.id === 'cooking-10:cooking-13')
    expect(edge.classes.split(' ')).toContain('same-author')
    expect(edge.classes.split(' ')).toContain('exception')
  })

  test('emphasizes the continuation path separately from incorporated history', () => {
    const path = getAncestors(actions, 'cooking-13')
    const layout = createActionLayout(actions, path)
    const classOf = (id) => layout.elements.find((element) => element.data.id === id).classes.split(' ')
    expect(path.map((node) => node.id)).toEqual(['cooking-1', 'cooking-2', 'cooking-5', 'cooking-8', 'cooking-9', 'cooking-10', 'cooking-13'])
    expect(classOf('cooking-4')).toContain('context')
    expect(classOf('cooking-4')).not.toContain('main')
    expect(classOf('cooking-4:cooking-13')).toContain('context')
    expect(classOf('cooking-1:cooking-4')).toContain('context')
    expect(classOf('cooking-10:cooking-13')).toContain('main')
    expect(classOf('cooking-14')).toContain('branch')
    expect(classOf('cooking-7:cooking-14')).toContain('branch')
  })

  test('shows depth from one rather than unique publication numbers', () => {
    const layout = createActionLayout(actions, mainPath)
    expect([...layout.levels.values()]).toEqual([1, 2, 2, 2, 3, 3, 3, 4, 5, 6, 6, 6, 7, 7, 3, 4, 2, 3])
    expect(layout.elements.find((element) => element.data.id === 'cooking-13').data.level).toBe('7')
    expect(layout.elements.find((element) => element.data.id === 'cooking-14').data.level).toBe('7')
  })

  test('uses the deepest source even when it is an additional reference and input is unordered', () => {
    const root = { ...actions[0], id: 'root', number: 800 }
    const first = { ...root, id: 'first', number: 400, parentId: root.id }
    const second = { ...root, id: 'second', number: 200, parentId: first.id }
    const merge = { ...root, id: 'merge', number: 100, parentId: root.id, mergedParentIds: [second.id, second.id] }
    const levels = getActionLevels([merge, second, first, root])
    expect(levels.get(root.id)).toBe(1)
    expect(levels.get(first.id)).toBe(2)
    expect(levels.get(second.id)).toBe(3)
    expect(levels.get(merge.id)).toBe(4)
  })

  test('rejects cyclic references instead of giving them misleading layers', () => {
    const a = { ...actions[0], id: 'a', parentId: 'b' }
    const b = { ...actions[0], id: 'b', parentId: 'a' }
    expect(() => getActionLevels([a, b])).toThrow('行动引用关系存在循环')
  })

  test('preserves relationships, fits horizontally and puts each source below its action', () => {
    const layout = createActionLayout(actions, mainPath)
    expect(layout.positions.size).toBe(18)
    for (const position of layout.positions.values()) {
      expect(position.x).toBeGreaterThanOrEqual(40)
      expect(position.x).toBeLessThanOrEqual(GRAPH_WIDTH - 40)
    }
    for (const reference of layout.references) {
      expect(layout.positions.get(reference.source.id).y).toBeGreaterThan(layout.positions.get(reference.target.id).y)
      const edge = layout.elements.find((element) => element.data.id === reference.id)
      expect(edge.classes.includes('other-author')).toBe(!reference.sameAuthor)
      expect(edge.classes.includes('exception')).toBe(reference.agreementStatus === 'exception')
    }
    expect(new Set([...layout.positions.values()].map((position) => position.y)).size).toBeLessThan(actions.length)
  })

  test('long chains grow vertically and empty or single-node projects remain usable', () => {
    const chain = Array.from({ length: 100 }, (_, i) => ({ ...actions[0], id: `node-${i}`, number: i + 1,
      parentId: i ? `node-${i - 1}` : undefined, mergedParentIds: [] }))
    const layout = createActionLayout(chain, chain)
    expect(layout.height).toBeGreaterThan(8000)
    expect(layout.positions.get('node-99').x).toBe(GRAPH_WIDTH / 2)
    expect(layout.levels.get('node-99')).toBe(100)
    expect(createActionLayout([], []).positions.size).toBe(0)
    expect(createActionLayout([actions[0]], [actions[0]]).positions.get(actions[0].id).x).toBe(GRAPH_WIDTH / 2)
  })
})
