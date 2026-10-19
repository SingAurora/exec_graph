import { describe, expect, test } from 'bun:test'
import { canFollowGraph, getFollowedActivity } from './activity.ts'
import { getPublishedExpressions } from '../../action/lib/published.ts'

const node = (number, extra = {}) => ({ id: String(number), number, projectId: 'cooking', authorId: 'lin', title: `行动 ${number}`, markdown: '行动记录', createdAt: `2026-10-${String(number).padStart(2, '0')}T12:00:00+08:00`, ...extra })

describe('followed graphs and users', () => {
  test('empty and missing graphs cannot be followed; another graph’s nodes do not unlock them', () => {
    const projects = [{ id: 'empty' }, { id: 'cooking' }]
    expect(canFollowGraph('empty', projects, [])).toBe(false)
    expect(canFollowGraph('empty', projects, [node(1)])).toBe(false)
    expect(canFollowGraph('missing', projects, [node(1, { projectId: 'missing' })])).toBe(false)
    expect(canFollowGraph('cooking', projects, [node(1)])).toBe(true)
  })

  test('graph follows include all authors, user follows cross graphs, overlapping sources appear once', () => {
    const actions = [node(1), node(2, { authorId: 'miao' }), node(3, { projectId: 'reading' }), node(4, { projectId: 'reading', authorId: 'jo' })]
    const sources = { graphIds: ['cooking'], userIds: ['lin'] }
    expect(getFollowedActivity(actions, sources).actions.map(({ id }) => id)).toEqual(['1', '2', '3'])
    expect(getFollowedActivity(actions, { graphIds: [], userIds: [] }).actions).toEqual([])
    expect(getFollowedActivity(actions, { graphIds: [], userIds: ['lin'] }).actions.map(({ id }) => id)).toEqual(['1', '3'])
  })

  test('a followed author’s old node does not become an expression endpoint when another author continues it', () => {
    const actions = [node(1, { expressionMarkdown: '保留实际结果' }), node(2, { authorId: 'miao', parentId: '1' })]
    const included = getFollowedActivity(actions, { graphIds: [], userIds: ['lin'] }).actions
    const ids = new Set(included.map(({ id }) => id))
    expect(getPublishedExpressions(actions).filter(({ id }) => ids.has(id))).toEqual([])
    const allIncluded = getFollowedActivity(actions, { graphIds: ['cooking'], userIds: ['lin'] }).actions
    expect(getPublishedExpressions(actions).filter(({ id }) => allIncluded.some((item) => item.id === id)).map(({ id }) => id)).toEqual(['2'])
  })

  test('agreement updates include responders or original authors, never merely the inheriting intermediary, without duplicates', () => {
    const actions = [node(1, { authorId: 'jo', agreementMarkdown: '记录实际用时' }), node(2, { parentId: '1' }),
      node(3, { parentId: '2', authorId: 'miao', referenceAgreements: [{ sourceId: '2', complies: true }] }),
      node(4, { parentId: '2', authorId: 'che', referenceAgreements: [{ sourceId: '2', complies: false }] })]
    const responses = (sources) => getFollowedActivity(actions, sources).agreementResponses.map(({ id }) => id)
    expect(responses({ graphIds: [], userIds: ['jo'] })).toEqual(['2:3'])
    expect(responses({ graphIds: [], userIds: ['lin'] })).toEqual([])
    expect(responses({ graphIds: [], userIds: ['miao'] })).toEqual(['2:3'])
    expect(responses({ graphIds: ['cooking'], userIds: ['jo', 'miao'] })).toEqual(['2:3'])
  })
})
