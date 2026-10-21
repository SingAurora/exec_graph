import { describe, expect, test } from 'bun:test'
import { searchPublicGraphs } from './search.ts'

const graph = (id, extra = {}) => ({ id, ownerId: 'jo', title: '生活练习', description: '真实记录', createdAt: '2026-10-01T12:00:00+08:00', ...extra })
const action = (id, projectId, createdAt) => ({ id, projectId, number: 1, authorId: 'jo', title: '行动', markdown: '实际完成', images: [], conversation: [], createdAt })

describe('public graph search', () => {
  test('matches names or introductions literally and ignores case and surrounding whitespace', () => {
    const projects = [graph('one', { title: 'RPG 日记' }), graph('two', { description: 'RPG 通关后的想法' }), graph('three')]
    expect(searchPublicGraphs(projects, [], ' rPg ').map(({ project }) => project.id)).toEqual(['one', 'two'])
    expect(searchPublicGraphs(projects, [], '[.*]')).toEqual([])
    expect(searchPublicGraphs(projects, [], '不存在')).toEqual([])
    expect(searchPublicGraphs(projects, [], '  ')).toEqual([])
  })

  test('finds graphs without actions and sorts by actual activity or creation, never metadata updates', () => {
    const projects = [graph('old', { updatedAt: '2027-01-01T00:00:00Z' }), graph('empty', { createdAt: '2026-10-03T12:00:00+08:00' }), graph('active')]
    const actions = [action('a', 'old', '2026-10-02T12:00:00+08:00'), action('b', 'active', '2026-10-04T12:00:00+08:00'), action('c', 'removed', '2026-10-05T12:00:00+08:00')]
    const results = searchPublicGraphs(projects, actions, '生活')
    expect(results.map(({ project }) => project.id)).toEqual(['active', 'empty', 'old'])
    expect(results[1].participantCount).toBe(0)
    expect(results[0].actionCount).toBe(1)
    expect(projects.map(({ id }) => id)).toEqual(['old', 'empty', 'active'])
  })
})
