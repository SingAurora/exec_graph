import { describe, expect, test } from 'bun:test'
import { getActionContinuationContext, getActionMergeCandidates } from './continuation.ts'
import { getActionExpression } from './expressions.ts'
import { getActionReferences } from './references.ts'

const node = (number, extra = {}) => ({ id: String(number), projectId: 'cooking', number, authorId: 'jo', title: `行动 ${number}`, markdown: `事实 ${number}`, images: [], conversation: [], createdAt: '2026-10-19T12:00:00+08:00', ...extra })
const actions = [
  node(1, { agreementMarkdown: '保留失败记录', expressionMarkdown: '先观察再下结论' }),
  node(2, { parentId: '1', agreementMarkdown: '记录锅温' }),
  node(3, { parentId: '1', agreementMarkdown: '静置十分钟', expressionMarkdown: '合入的观点' }),
  node(4, { parentId: '3', objectiveMarkdown: '实际静置了五分钟' }),
  node(5, { parentId: '1', agreementMarkdown: '' }),
  node(6, { projectId: 'other' }),
  node(7, { parentId: '1', agreementMarkdown: '记录用时' }),
]

describe('continuation and merged sources', () => {
  test('lists only other route endpoints, excluding the primary history and other graphs', () => {
    expect(getActionMergeCandidates(actions, '2').map((item) => item.id)).toEqual(['7', '5', '4'])
    expect(getActionMergeCandidates(actions, 'missing')).toEqual([])
  })

  test('being incorporated also ends eligibility, while references in another graph do not', () => {
    const graph = [...actions, node(8, { parentId: '7', mergedParentIds: ['4'] }), node(9, { projectId: 'other', parentId: '5', mergedParentIds: ['8'] })]
    expect(getActionMergeCandidates(graph, '2').map((item) => item.id)).toEqual(['8', '5'])
    expect(getActionContinuationContext(graph, '2', ['4'])).toBeUndefined()
    expect(getActionContinuationContext(graph, '2', ['8', '5'])).toBeDefined()
  })

  test('rejects selected sources that gain a continuation or merge before publication', () => {
    expect(getActionContinuationContext(actions, '2', ['4', '5'])).toBeDefined()
    const advanced = [...actions, node(8, { parentId: '4' }), node(9, { parentId: '7', mergedParentIds: ['5'] })]
    expect(getActionContinuationContext(advanced, '2', ['4', '5'])).toBeUndefined()
    expect(getActionContinuationContext(advanced, '2', ['8', '9'])).toBeDefined()
  })

  test('an isolated starting node is eligible without depending on expression content', () => {
    const graph = [...actions, node(8, { expressionMarkdown: '' })]
    expect(getActionMergeCandidates(graph, '2').map((item) => item.id)).toEqual(['8', '7', '5', '4'])
    expect(getActionContinuationContext(graph, '2', ['8']).facts.map((item) => item.number)).toEqual([1, 2, 8])
  })

  test('unions all cited history, deduplicates shared ancestors and uses each direct effective agreement', () => {
    const context = getActionContinuationContext(actions, '2', ['4', '5'])
    expect(context.facts.map((fact) => fact.number)).toEqual([1, 2, 3, 4, 5])
    expect(context.facts.find((fact) => fact.number === 4).markdown).toBe('实际静置了五分钟')
    expect(context.sources.map(({ node, kind, agreement }) => [node.id, kind, agreement.markdown, agreement.sourceNode?.id])).toEqual([
      ['2', 'primary', '记录锅温', '2'], ['4', 'merged', '静置十分钟', '3'], ['5', 'merged', '', '5'],
    ])
  })

  test('rejects missing, duplicate, already-known and cross-graph direct sources', () => {
    for (const ids of [['missing'], ['4', '4'], ['1'], ['2'], ['3'], ['6']]) expect(getActionContinuationContext(actions, '2', ids)).toBeUndefined()
    expect(getActionContinuationContext(actions, 'missing', ['4'])).toBeUndefined()
  })

  test('published source assessments independently drive every link without changing inherited expression or agreement', () => {
    const assessments = [{ sourceId: '2', complies: true }, { sourceId: '4', complies: false, exceptionReason: '只静置了五分钟' }]
    const published = node(8, { parentId: '2', mergedParentIds: ['4', '5', '7'], referenceAgreements: assessments })
    const graph = [...actions, published]
    const incoming = getActionReferences(graph).filter((item) => item.target.id === '8')
    expect(incoming.map((item) => [item.source.id, item.incorporated, item.agreementStatus])).toEqual([
      ['2', false, 'satisfied'], ['4', true, 'exception'], ['5', true, 'unrestricted'], ['7', true, 'unreviewed'],
    ])
    expect(incoming.find((item) => item.source.id === '4').exceptionReason).toBe('只静置了五分钟')
    expect(getActionExpression(graph, '8').markdown).toBe('先观察再下结论')
    expect(getActionContinuationContext(graph, '8').sources[0].agreement.markdown).toBe('记录锅温')
  })
})
