import { describe, expect, test } from 'bun:test'
import { getPublishedExpressions } from '../../../entities/action/lib/published.ts'
import { getActionReferences } from '../../../entities/action/lib/references.ts'
import { getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses.ts'
import { searchDiscoveryAgreements, searchDiscoveryExpressions } from './search.ts'

const base = { projectId: 'cooking', images: [], conversation: [], createdAt: '2026-10-21T12:00:00+08:00' }
const actions = [
  { ...base, id: 'first', number: 1, authorId: 'lin', title: '开火', markdown: '切了番茄', expressionMarkdown: '分开加热更好吃', agreementMarkdown: '记录用时 ![过程](https://example.com/secret-image.jpg)' },
  { ...base, id: 'middle', number: 2, authorId: 'qiao', title: '第二顿', markdown: '鸡蛋先盛出', parentId: 'first', referenceAgreements: [{ sourceId: 'first', complies: true }] },
  { ...base, id: 'last', number: 3, authorId: 'robin', title: '第三顿', markdown: '加入了葱花', parentId: 'middle', referenceAgreements: [{ sourceId: 'middle', complies: true }] },
  { ...base, id: 'clear', number: 4, authorId: 'qiao', title: '清空', markdown: '实际尝试', parentId: 'first', expressionMarkdown: '', referenceAgreements: [{ sourceId: 'first', complies: false }] },
]
const users = [{ id: 'lin', name: '林岚' }, { id: 'qiao', name: '乔' }, { id: 'robin', name: 'Robin' }]
const ids = (items) => items.map((item) => item.id)

describe('discovery keyword filters', () => {
  test('searches current effective expressions, including inherited authors, excluding cleared and superseded documents', () => {
    const candidates = getPublishedExpressions(actions)
    expect(ids(searchDiscoveryExpressions(candidates, actions, users, ' 分开加热 '))).toEqual(['last'])
    expect(ids(searchDiscoveryExpressions(candidates, actions, users, '林岚'))).toEqual(['last'])
    expect(searchDiscoveryExpressions(candidates, actions, users, '实际尝试')).toEqual([])
    expect(searchDiscoveryExpressions(candidates, actions, users, '   ')).toBe(candidates)
  })

  test('expression search uses literal case-insensitive names without searching background action bodies', () => {
    const candidates = getPublishedExpressions(actions)
    expect(searchDiscoveryExpressions(candidates, actions, users, '葱花')).toEqual([])
    expect(ids(searchDiscoveryExpressions(candidates, actions, users, 'roBIN'))).toEqual(['last'])
    expect(searchDiscoveryExpressions(candidates, actions, users, '[.*]')).toEqual([])
  })

  test('agreement search finds the original author through inheritance without searching image addresses', () => {
    const candidates = getSatisfiedAgreementResponses(getActionReferences(actions))
    expect(ids(searchDiscoveryAgreements(candidates, users, '林岚'))).toEqual(['middle:last', 'first:middle'])
    expect(ids(searchDiscoveryAgreements(candidates, users, '第三顿'))).toEqual(['middle:last'])
    expect(searchDiscoveryAgreements(candidates, users, 'secret-image')).toEqual([])
    expect(searchDiscoveryAgreements(candidates, users, '不存在')).toEqual([])
  })

})
