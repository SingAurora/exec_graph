import { describe, expect, test } from 'bun:test'
import { getPublishedExpressions } from './published.ts'
import { getActionReferences } from './references.ts'
import { getProfileAgreementResponses } from './agreement-responses.ts'
import { searchActions, searchAgreementResponses, searchExpressions } from './search.ts'

const base = { projectId: 'cooking', images: [], conversation: [], createdAt: '2026-10-21T12:00:00+08:00' }
const source = { ...base, id: 'source', number: 1, authorId: 'lin', title: '第一次尝试', markdown: '切番茄', expressionMarkdown: '火候比调味更重要', agreementMarkdown: '请记录用时 ![过程](https://example.com/image-only.jpg)' }
const mine = { ...base, id: 'mine', number: 2, authorId: 'jo', parentId: 'source', title: '第二次尝试', markdown: '旧记录', objectiveMarkdown: '三分钟炒好鸡蛋 ![过程](https://example.com/image-only.jpg)', referenceAgreements: [{ sourceId: 'source', complies: true }], conversation: [{ id: 'chat', speaker: 'user', text: '对话私有词' }] }
const other = { ...base, id: 'other', number: 3, authorId: 'lin', title: '别人行动', markdown: '三分钟也可以', expressionMarkdown: '这是别人的表达' }
const actions = [source, mine, other]
const users = [{ id: 'jo', name: 'Jo' }, { id: 'lin', name: '林岚' }]
const ids = (items) => items.map((item) => item.id)

describe('profile content search', () => {
  test('effective inherited expressions can use full context without expanding the profile scope', () => {
    const candidates = getPublishedExpressions(actions, ['jo'])
    expect(ids(searchExpressions(candidates, actions, users, ' 火候 '))).toEqual(['mine'])
    expect(ids(searchExpressions(candidates, actions, users, '林岚'))).toEqual(['mine'])
    expect(searchExpressions(candidates, actions, users, '别人')).toEqual([])
    expect(searchExpressions(candidates, actions, users, '三分钟')).toEqual([])
  })

  test('actions use current objective records, support literal queries and keep input order', () => {
    const candidates = [mine, source]
    expect(ids(searchActions(candidates, users, '三分钟'))).toEqual(['mine'])
    expect(ids(searchActions(candidates, users, '尝试'))).toEqual(['mine', 'source'])
    expect(ids(searchActions(candidates, users, ' JO '))).toEqual(['mine'])
    for (const query of ['旧记录', '火候', '对话私有词', 'image-only', '[.*]']) {
      expect(searchActions(candidates, users, query)).toEqual([])
    }
  })

  test('legacy action records remain searchable when objectiveMarkdown is absent', () => {
    expect(ids(searchActions(actions, users, '切番茄'))).toEqual(['source'])
    expect(searchActions([{ ...source, objectiveMarkdown: '' }], users, '切番茄')).toEqual([])
  })

  test('profile agreement exchanges search both participants and preserve reference identity for navigation', () => {
    const candidates = getProfileAgreementResponses(getActionReferences(actions), 'jo')
    expect(ids(searchAgreementResponses(candidates, users, '记录用时'))).toEqual(['source:mine'])
    for (const query of ['林岚', 'JO', '第二次']) {
      expect(searchAgreementResponses(candidates, users, query)[0]).toBe(candidates[0])
    }
    expect(searchAgreementResponses(candidates, users, 'image-only')).toEqual([])
  })

  test('blank queries return the original lists without resetting their order', () => {
    const references = getProfileAgreementResponses(getActionReferences(actions), 'jo')
    expect(searchActions(actions, users, '  ')).toBe(actions)
    expect(searchExpressions(actions, actions, users, '')).toBe(actions)
    expect(searchAgreementResponses(references, users, ' ')).toBe(references)
  })
})
