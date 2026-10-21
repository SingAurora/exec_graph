import { describe, expect, test } from 'bun:test'
import { searchGraphAgreementResponses, searchGraphDocuments, searchGraphParticipants } from './search.ts'
import { getSearchExcerpt } from '../../../shared/lib/search.ts'
import { cookingActions } from '../../../app/demo/cooking/index.ts'
import { cookingParticipants } from '../../../app/demo/cooking/participants.ts'

function node(id, extra = {}) {
  return { id, projectId: 'graph', number: Number(id), authorId: 'cook', title: '晚饭', markdown: '本次行动', images: [], conversation: [], createdAt: `2026-10-${id.padStart(2, '0')}T12:00:00+08:00`, ...extra }
}

describe('graph-local document search', () => {
  test('searches inherited effective expression at the endpoint, without borrowing action facts', () => {
    const actions = [node('1', { expressionMarkdown: '慢慢练习才有改变' }), node('2', { parentId: '1', objectiveMarkdown: '放了葱' })]
    expect(searchGraphDocuments(actions, 'graph', '练习', 'expression').map((item) => item.id)).toEqual(['2'])
    expect(searchGraphDocuments(actions, 'graph', '葱', 'expression')).toEqual([])
    expect(searchGraphDocuments(actions, 'graph', '葱', 'objective').map((item) => item.id)).toEqual(['2'])
    expect(searchGraphDocuments([...actions, node('3', { parentId: '2', expressionMarkdown: '' })], 'graph', '练习', 'expression')).toEqual([])
  })

  test('ranks title matches before body matches, then keeps newest publication order', () => {
    const actions = [node('1', { title: '少油' }), node('2', { title: '少油练习' }), node('3', { markdown: '这次少油' }), node('4', { title: '少油记录' })]
    expect(searchGraphDocuments(actions, 'graph', '少油', 'objective').map((item) => item.id)).toEqual(['1', '4', '2', '3'])
    expect(actions.map((item) => item.id)).toEqual(['1', '2', '3', '4'])
  })

  test('ignores other graphs, blank queries, image URLs and formatting-only matches', () => {
    const actions = [node('1', { markdown: '![少油照片](https://example.com/少油.jpg)' }), node('2', { projectId: 'other', markdown: '少油' })]
    expect(searchGraphDocuments(actions, 'graph', '少油', 'objective')).toEqual([])
    expect(searchGraphDocuments(actions, 'graph', '  ', 'objective')).toEqual([])
  })

  test('demo queries lead to existing independently readable nodes', () => {
    expect(searchGraphDocuments(cookingActions, 'cooking', '十八分钟', 'expression').map((item) => item.id)).toContain('cooking-14')
    expect(searchGraphDocuments(cookingActions, 'cooking', '油减到', 'expression')).toEqual([])
    expect(searchGraphDocuments(cookingActions, 'cooking', '油减到', 'objective').map((item) => item.id)).toEqual(['cooking-12'])
    expect(searchGraphDocuments(cookingActions, 'cooking', '葱花', 'objective').map((item) => item.id)).toEqual(['cooking-18'])
    expect(searchGraphParticipants(cookingActions, cookingParticipants, 'cooking', 'roBIN').map((user) => user.id)).toEqual(['robin'])
  })

  test('starts the result excerpt near a deep match', () => {
    const text = '开头内容'.repeat(100) + '少油结果在这里'
    expect(getSearchExcerpt(text, '少油')).toContain('少油结果在这里')
    expect(getSearchExcerpt(text, '少油').startsWith('…')).toBe(true)
  })

  test('allows author-only searches and applies expression authors after resolving route endpoints', () => {
    const actions = [node('1', { authorId: 'jo', expressionMarkdown: '慢慢练习才有改变' }),
      node('2', { authorId: 'lin', parentId: '1' }), node('3', { authorId: 'jo', projectId: 'other' })]
    expect(searchGraphDocuments(actions, 'graph', '', 'expression', 'lin').map((item) => item.id)).toEqual(['2'])
    expect(searchGraphDocuments(actions, 'graph', '', 'expression', 'jo')).toEqual([])
    expect(searchGraphDocuments(actions, 'graph', '', 'objective', 'jo').map((item) => item.id)).toEqual(['1'])
    expect(searchGraphDocuments(actions, 'graph', '练习', 'expression', 'lin').map((item) => item.id)).toEqual(['2'])
    expect(searchGraphDocuments(actions, 'graph', '没有这个词', 'expression', 'lin')).toEqual([])
  })
})

describe('agreement response search', () => {
  const sources = [node('1', { authorId: 'jo', agreementMarkdown: '记录实际用时。\n\n![示意](/only-photo.jpg)' }),
    node('2', { parentId: '1', authorId: 'lin', title: '盛蛋早了一些', referenceAgreements: [{ sourceId: '1', complies: true }] }),
    node('3', { parentId: '2', authorId: 'miao', referenceAgreements: [{ sourceId: '2', complies: true }] }),
    node('4', { parentId: '2', authorId: 'jo', referenceAgreements: [{ sourceId: '2', complies: true }] }),
    node('5', { parentId: '1', authorId: 'lin', referenceAgreements: [{ sourceId: '1', complies: false }] }),
    node('6', { parentId: '1', authorId: 'miao' }),
    node('7', { projectId: 'other', authorId: 'jo', agreementMarkdown: '记录用时' }),
    node('8', { projectId: 'other', authorId: 'lin', parentId: '7', referenceAgreements: [{ sourceId: '7', complies: true }] })]

  test('filters either role of selected participants and attributes inherited agreements to their actual author', () => {
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '', participantId: 'jo' }).map((item) => item.id)).toEqual(['2:3', '1:2'])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '', participantId: 'miao', otherParticipantId: 'jo' }).map((item) => item.id)).toEqual(['2:3'])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '', participantId: 'miao', otherParticipantId: 'lin' })).toEqual([])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '', otherParticipantId: 'jo' }).map((item) => item.id)).toEqual(['2:3', '1:2'])
  })

  test('combines both directions newest first, intersects keywords and excludes unrelated exchanges', () => {
    const actions = [...sources,
      node('9', { authorId: 'lin', agreementMarkdown: '写下盛蛋时的状态' }),
      node('10', { parentId: '9', authorId: 'jo', referenceAgreements: [{ sourceId: '9', complies: true }] })]
    const criteria = { keyword: '', participantId: 'jo', otherParticipantId: 'lin' }
    const forward = searchGraphAgreementResponses(actions, 'graph', criteria)
    expect(forward.map((item) => item.id)).toEqual(['9:10', '1:2'])
    expect(searchGraphAgreementResponses(actions, 'graph', { ...criteria, participantId: 'lin', otherParticipantId: 'jo' })).toEqual(forward)
    expect(searchGraphAgreementResponses(actions, 'graph', { ...criteria, keyword: '实际用时' }).map((item) => item.id)).toEqual(['1:2'])
    expect(searchGraphAgreementResponses(actions, 'graph', { ...criteria, otherParticipantId: 'jo' })).toEqual([])
  })

  test('matches agreement text or response title, excluding unrelated facts, images and other graphs', () => {
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '用时' }).map((item) => item.id)).toEqual(['2:3', '1:2'])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '盛蛋' }).map((item) => item.id)).toEqual(['1:2'])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: '本次行动' })).toEqual([])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: 'only-photo' })).toEqual([])
    expect(searchGraphAgreementResponses(sources, 'graph', { keyword: ' ' })).toEqual([])
  })
})

describe('participant search', () => {
  test('matches nicknames only, deduplicates participants, and prioritizes exact names', () => {
    const user = (id, name) => ({ id, name, bio: 'Robin 的简介', email: 'robin@example.com', avatar: '', gender: 'unknown', activeDays: 1 })
    const actions = [node('1'), node('2'), node('3', { authorId: 'second' }), node('4', { authorId: 'outside', projectId: 'other' })]
    const users = [user('cook', 'Robin小厨'), user('second', 'Robin'), user('cook', 'Robin小厨'), user('outside', 'Robin')]
    expect(searchGraphParticipants(actions, users, 'graph', 'robin').map((item) => item.id)).toEqual(['second', 'cook'])
    expect(searchGraphParticipants(actions, users, 'graph', '简介')).toEqual([])
    expect(searchGraphParticipants(actions, users, 'graph', '')).toEqual([])
  })
})
