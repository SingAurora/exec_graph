import { describe, expect, test } from 'bun:test'
import { getActiveGraphActivities, getGraphActivity, hasUserContributed } from './activity.ts'
import { getPublishedExpressions } from '../../action/lib/published.ts'

const node = (id, extra = {}) => ({
  id, projectId: 'g', number: Number(id), authorId: 'jo', title: '行动', markdown: '完成了某件事',
  images: [], conversation: [], createdAt: `2026-10-${id.padStart(2, '0')}T12:00:00+08:00`, ...extra,
})
const graph = { id: 'g', ownerId: 'owner', participantIds: ['stale'], title: '公开图', description: '', createdAt: '2026-10-01T00:00:00+08:00' }

describe('public graph activity', () => {
  test('counts actual distinct authors and current nonempty expressions, ignoring legacy membership and other graphs', () => {
    const nodes = [node('1', { expressionMarkdown: '先观察' }), node('2', { parentId: '1', authorId: 'lin' }), node('3', { parentId: '1', expressionMarkdown: '' }), node('4', { projectId: 'other', authorId: 'outside' })]
    expect(getGraphActivity(graph, nodes)).toEqual({ project: graph, actionCount: 3, expressionCount: 1, participantCount: 2, lastActionAt: nodes[2].createdAt })
    expect(hasUserContributed('g', 'stale', nodes)).toBe(false)
    expect(hasUserContributed('g', 'owner', nodes)).toBe(false)
    expect(hasUserContributed('g', 'lin', nodes)).toBe(true)
    expect(getGraphActivity(graph, [])).toEqual({ project: graph, actionCount: 0, expressionCount: 0, participantCount: 0, lastActionAt: undefined })
  })

  test('filters followed authors only after resolving endpoints across all authors and merge references', () => {
    const nodes = [node('1', { expressionMarkdown: '旧表达' }), node('2', { parentId: '1', authorId: 'lin' }), node('3', { expressionMarkdown: '另一条链' }), node('4', { parentId: '2', mergedParentIds: ['3'], authorId: 'miao' })]
    expect(getPublishedExpressions(nodes, ['jo'])).toEqual([])
    expect(getPublishedExpressions(nodes, ['miao']).map((item) => item.id)).toEqual(['4'])
    expect(getPublishedExpressions(nodes, [])).toEqual([])
  })

  test('inheritance remains readable, explicit clearing propagates, and only a later new expression returns', () => {
    const nodes = [node('1', { expressionMarkdown: '起初的看法' }), node('2', { parentId: '1' }), node('3', { parentId: '2', expressionMarkdown: '' }), node('4', { parentId: '3' })]
    expect(getPublishedExpressions(nodes)).toEqual([])
    const update = node('5', { parentId: '4', expressionMarkdown: '新的看法' })
    expect(getPublishedExpressions([...nodes, update])).toEqual([update])
  })

  test('a reference from another graph cannot remove a local endpoint or borrow its expression', () => {
    const root = node('1', { expressionMarkdown: '本图表达' })
    const foreign = node('2', { projectId: 'other', parentId: '1' })
    expect(getPublishedExpressions([root, foreign])).toEqual([root])
  })

  test('discovery excludes empty and unknown graphs and orders real activity rather than metadata edits', () => {
    const projects = [{ ...graph, updatedAt: '2026-12-01T00:00:00+08:00' },
      { ...graph, id: 'newer', title: '最近行动的图' },
      { ...graph, id: 'empty', createdAt: '2026-12-01T00:00:00+08:00' }]
    const nodes = [node('1'), node('2', { projectId: 'newer', authorId: 'lin' }),
      node('3', { projectId: 'missing' })]
    const activities = getActiveGraphActivities(projects, nodes)
    expect(activities.map(({ project }) => project.id)).toEqual(['newer', 'g'])
    expect(activities[0].participantCount).toBe(1)
    expect(activities[0].lastActionAt).toBe(nodes[1].createdAt)
    expect(getActiveGraphActivities(projects, [])).toEqual([])
    expect(projects.map(({ id }) => id)).toEqual(['g', 'newer', 'empty'])
  })
})
