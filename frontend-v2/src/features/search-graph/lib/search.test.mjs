import { describe, expect, test } from 'bun:test'
import { searchGraphDocuments, searchGraphParticipants } from './search.ts'
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
