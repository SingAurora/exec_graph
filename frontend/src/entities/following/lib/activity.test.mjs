import { describe, expect, test } from 'bun:test'
import { canFollowGraph, getFollowedActivity, getFollowedAgreementRecipient } from './activity.ts'

const node = (number, extra = {}) => ({ uuid: String(number), id: String(number), number, graphUuid: 'cooking', authorUuid: 'lin', title: `行动 ${number}`, markdown: '行动记录', createdAt: `2026-10-${String(number).padStart(2, '0')}T12:00:00+08:00`, ...extra })

describe('followed graphs and users', () => {
  test('empty and missing graphs cannot be followed; another graph’s nodes do not unlock them', () => {
    const graphs = [{ uuid: 'empty', id: 'empty' }, { uuid: 'cooking', id: 'cooking' }]
    expect(canFollowGraph('empty', graphs, [])).toBe(false)
    expect(canFollowGraph('empty', graphs, [node(1)])).toBe(false)
    expect(canFollowGraph('missing', graphs, [node(1, { graphUuid: 'missing' })])).toBe(false)
    expect(canFollowGraph('cooking', graphs, [node(1)])).toBe(true)
  })

  test('graph follows include all authors, user follows cross graphs, overlapping sources appear once', () => {
    const actions = [node(1), node(2, { authorUuid: 'miao' }), node(3, { graphUuid: 'reading' }), node(4, { graphUuid: 'reading', authorUuid: 'jo' })]
    const sources = { graphUuids: ['cooking'], userUuids: ['lin'] }
    expect(getFollowedActivity(actions, sources).actions.map(({ uuid }) => uuid)).toEqual(['3', '2', '1'])
    expect(getFollowedActivity(actions, { graphUuids: [], userUuids: [] }).actions).toEqual([])
    expect(getFollowedActivity(actions, { graphUuids: [], userUuids: ['lin'] }).actions.map(({ uuid }) => uuid)).toEqual(['3', '1'])
  })

  test('a followed author’s old node does not become an expression endpoint when another author continues it', () => {
    const actions = [node(1, { expressionMarkdown: '保留实际结果' }), node(2, { authorUuid: 'miao', parentUuid: '1' })]
    expect(getFollowedActivity(actions, { graphUuids: [], userUuids: ['lin'] }).expressions).toEqual([])
    expect(getFollowedActivity(actions, { graphUuids: ['cooking'], userUuids: ['lin'] }).expressions.map(({ uuid }) => uuid)).toEqual(['2'])
  })

  test('agreement updates include responders or original authors, never merely the inheriting intermediary, without duplicates', () => {
    const actions = [node(1, { authorUuid: 'jo', agreementMarkdown: '记录实际用时' }), node(2, { parentUuid: '1' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', referenceAgreements: [{ sourceUuid: '2', complies: true }] }),
      node(4, { parentUuid: '2', authorUuid: 'che', referenceAgreements: [{ sourceUuid: '2', complies: false }] })]
    const responses = (sources) => getFollowedActivity(actions, sources).agreementResponses.map(({ uuid }) => uuid)
    expect(responses({ graphUuids: [], userUuids: ['jo'] })).toEqual(['2:3'])
    expect(responses({ graphUuids: [], userUuids: ['lin'] })).toEqual([])
    expect(responses({ graphUuids: [], userUuids: ['miao'] })).toEqual(['2:3'])
    expect(responses({ graphUuids: ['cooking'], userUuids: ['jo', 'miao'] })).toEqual(['2:3'])
  })

  test('expression lists retain current endpoints only, omit cleared or empty branches, and use the latest revision time', () => {
    const actions = [node(1, { expressionMarkdown: '第一条链的表达' }), node(2, { parentUuid: '1' }),
      node(3, { expressionMarkdown: '已清空的链' }), node(4, { parentUuid: '3', expressionMarkdown: '' }),
      node(5), node(6, { expressionMarkdown: '较新的表达' }),
      node(7, { expressionMarkdown: '另一条表达', authorUuid: 'jo', graphUuid: 'reading' })]
    const sources = { graphUuids: ['cooking'], userUuids: ['lin'] }
    expect(getFollowedActivity(actions, sources).expressions.map(({ uuid }) => uuid)).toEqual(['6', '2'])
    const revised = actions.map((item) => item.uuid === '2' ? { ...item, expressionSupplement: { authorUuid: 'lin', createdAt: '2026-10-21T12:00:00+08:00' } } : item)
    expect(getFollowedActivity(revised, sources).expressions.map(({ uuid }) => uuid)).toEqual(['2', '6'])
    expect(getFollowedActivity(revised, sources).actions.map(({ uuid }) => uuid)).toEqual(['6', '5', '4', '3', '2', '1'])
    expect(actions[1].expressionSupplement).toBeUndefined()
  })

  test('only unfamiliar responders need the followed agreement origin explained', () => {
    const actions = [node(1, { authorUuid: 'jo', agreementMarkdown: '写明实际用时' }), node(2, { parentUuid: '1' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', referenceAgreements: [{ sourceUuid: '2', complies: true }] })]
    const sources = { graphUuids: [], userUuids: ['jo'] }
    const [reference] = getFollowedActivity(actions, sources).agreementResponses
    expect(getFollowedAgreementRecipient(reference, sources)).toBe('jo')
    expect(getFollowedAgreementRecipient(reference, { graphUuids: [], userUuids: ['lin'] })).toBeUndefined()
    expect(getFollowedAgreementRecipient(reference, { graphUuids: [], userUuids: ['jo', 'miao'] })).toBeUndefined()
    expect(getFollowedAgreementRecipient(reference, { graphUuids: ['cooking'], userUuids: ['jo'] })).toBeUndefined()
  })
})
