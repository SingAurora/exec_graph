import { describe, expect, test } from 'bun:test'
import { canFollowGraph, getFollowedActivity, getFollowedAgreementRecipient } from './activity.ts'

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
    expect(getFollowedActivity(actions, sources).actions.map(({ id }) => id)).toEqual(['3', '2', '1'])
    expect(getFollowedActivity(actions, { graphIds: [], userIds: [] }).actions).toEqual([])
    expect(getFollowedActivity(actions, { graphIds: [], userIds: ['lin'] }).actions.map(({ id }) => id)).toEqual(['3', '1'])
  })

  test('a followed author’s old node does not become an expression endpoint when another author continues it', () => {
    const actions = [node(1, { expressionMarkdown: '保留实际结果' }), node(2, { authorId: 'miao', parentId: '1' })]
    expect(getFollowedActivity(actions, { graphIds: [], userIds: ['lin'] }).expressions).toEqual([])
    expect(getFollowedActivity(actions, { graphIds: ['cooking'], userIds: ['lin'] }).expressions.map(({ id }) => id)).toEqual(['2'])
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

  test('expression lists retain current endpoints only, omit cleared or empty branches, and use the latest revision time', () => {
    const actions = [node(1, { expressionMarkdown: '第一条链的表达' }), node(2, { parentId: '1' }),
      node(3, { expressionMarkdown: '已清空的链' }), node(4, { parentId: '3', expressionMarkdown: '' }),
      node(5), node(6, { expressionMarkdown: '较新的表达' }),
      node(7, { expressionMarkdown: '另一条表达', authorId: 'jo', projectId: 'reading' })]
    const sources = { graphIds: ['cooking'], userIds: ['lin'] }
    expect(getFollowedActivity(actions, sources).expressions.map(({ id }) => id)).toEqual(['6', '2'])
    const revised = actions.map((item) => item.id === '2' ? { ...item, expressionSupplement: { authorId: 'lin', createdAt: '2026-10-21T12:00:00+08:00' } } : item)
    expect(getFollowedActivity(revised, sources).expressions.map(({ id }) => id)).toEqual(['2', '6'])
    expect(getFollowedActivity(revised, sources).actions.map(({ id }) => id)).toEqual(['6', '5', '4', '3', '2', '1'])
    expect(actions[1].expressionSupplement).toBeUndefined()
  })

  test('only unfamiliar responders need the followed agreement origin explained', () => {
    const actions = [node(1, { authorId: 'jo', agreementMarkdown: '写明实际用时' }), node(2, { parentId: '1' }),
      node(3, { parentId: '2', authorId: 'miao', referenceAgreements: [{ sourceId: '2', complies: true }] })]
    const sources = { graphIds: [], userIds: ['jo'] }
    const [reference] = getFollowedActivity(actions, sources).agreementResponses
    expect(getFollowedAgreementRecipient(reference, sources)).toBe('jo')
    expect(getFollowedAgreementRecipient(reference, { graphIds: [], userIds: ['lin'] })).toBeUndefined()
    expect(getFollowedAgreementRecipient(reference, { graphIds: [], userIds: ['jo', 'miao'] })).toBeUndefined()
    expect(getFollowedAgreementRecipient(reference, { graphIds: ['cooking'], userIds: ['jo'] })).toBeUndefined()
  })
})
