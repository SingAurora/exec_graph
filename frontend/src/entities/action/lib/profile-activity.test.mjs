import { describe, expect, test } from 'bun:test'
import { getActivityDate, getProfileActivity, getProfileActivityDays, groupProfileActivity } from './profile-activity.ts'

const node = (id, extra = {}) => ({
  id, projectId: 'cooking', number: Number(id), authorId: 'jo', title: '行动 ' + id,
  markdown: '实际做过的事情', images: [], conversation: [], createdAt: '2026-10-20T12:00:00+08:00', ...extra,
})

describe('profile action activity', () => {
  test('one published action stays one event despite expression edits and multiple agreement responses', () => {
    const actions = [node('1', { authorId: 'lin', agreementMarkdown: '记录用时' }),
      node('2', { authorId: 'miao', agreementMarkdown: '记录实际锅具' }),
      node('3', { parentId: '1', mergedParentIds: ['2'], expressionMarkdown: '我认为先实践再下结论',
        expressionSupplement: { authorId: 'jo', createdAt: '2026-10-21T12:00:00+08:00' },
        agreementSupplement: { authorId: 'jo', createdAt: '2026-10-22T12:00:00+08:00' },
        referenceAgreements: [{ sourceId: '1', complies: true }, { sourceId: '2', complies: true }] })]
    const activity = getProfileActivity(actions, 'jo')
    expect(activity).toHaveLength(1)
    const days = getProfileActivityDays(activity, new Date('2026-10-22T12:00:00+08:00'))
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(1)
    expect(days.find((day) => day.date === activity[0].date).count).toBe(1)
    expect(days.at(-1).count).toBe(0)
  })

  test('inherited, updated and cleared expressions do not add timeline events', () => {
    const activity = getProfileActivity([node('1', { expressionMarkdown: '最初的表达' }),
      node('2', { parentId: '1' }), node('3', { parentId: '2', expressionMarkdown: '' })], 'jo')
    expect(activity.map((item) => item.node.id)).toEqual(['3', '2', '1'])
  })

  test('sorts newest first, groups local dates and never counts someone else or malformed dates', () => {
    const actions = [node('1', { createdAt: '2026-10-19T12:00:00+08:00' }),
      node('2'), node('3'), node('4', { authorId: 'other' }), node('5', { createdAt: 'invalid' })]
    const activity = getProfileActivity(actions, 'jo')
    const groups = groupProfileActivity(activity)
    expect(groups.map((group) => group.items.map((item) => item.node.id))).toEqual([['3', '2'], ['1']])
    expect(activity[0].date).toBe(getActivityDate(actions[2].createdAt))
    expect(actions.map((item) => item.id)).toEqual(['1', '2', '3', '4', '5'])
  })

  test('calendar keys follow the local date instead of the UTC date', () => {
    const localMidnight = new Date(2026, 9, 21, 0, 5)
    expect(getActivityDate(localMidnight)).toBe('2026-10-21')
    expect(getActivityDate(localMidnight.toISOString())).toBe('2026-10-21')
  })

  test('a rolling year has 365 unique local days across a leap day, excluding older and future dates', () => {
    const activity = getProfileActivity([node('1', { createdAt: new Date(2023, 2, 1, 12).toISOString() }),
      node('2', { createdAt: new Date(2024, 1, 29, 12).toISOString() }),
      node('3', { createdAt: new Date(2024, 2, 2, 12).toISOString() })], 'jo')
    const days = getProfileActivityDays(activity, new Date(2024, 2, 1, 12))
    expect(days).toHaveLength(365)
    expect(new Set(days.map((day) => day.date)).size).toBe(365)
    expect(days[0].date).toBe('2023-03-03')
    expect(days.at(-1).date).toBe('2024-03-01')
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(1)
  })
})
