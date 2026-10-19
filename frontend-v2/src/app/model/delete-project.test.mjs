import { describe, expect, test } from 'bun:test'
import { canDeleteProject, getProjectDeletionDisabledReason, isProjectParticipant } from '../../entities/project/lib/permissions.ts'
import { deleteProjectContent } from './delete-project.ts'

const graph = (id, ownerId = 'jo', participantIds = []) => ({ id, ownerId, participantIds, title: id })
const node = (id, projectId, authorId = 'jo') => ({ id, projectId, authorId })
const state = (projects, actions = []) => ({ projects, actions, topics: [], plans: [], completions: [], reactions: {} })

describe('graph deletion permission', () => {
  test('the creator can delete an empty graph without having authored a node', () => {
    const content = state([graph('empty')])
    expect(deleteProjectContent(content, 'empty', 'jo', 0)?.projects).toEqual([])
    expect(content.projects).toHaveLength(1)
  })

  test('participants retain settings access but cannot delete a graph shared with its creator', () => {
    expect(isProjectParticipant(graph('a', 'lin', ['jo']), 'jo', [])).toBe(true)
    expect(isProjectParticipant(graph('a', 'lin'), 'jo', [node('1', 'a')])).toBe(true)
    expect(canDeleteProject(graph('a', 'lin', ['jo']), 'jo', [])).toBe(false)
    expect(canDeleteProject(graph('a', 'lin'), 'jo', [node('1', 'a')])).toBe(false)
    expect(canDeleteProject(graph('a', 'lin'), 'jo', [node('1', 'b')])).toBe(false)
    const content = state([graph('a', 'lin')], [node('1', 'a', 'lin')])
    expect(deleteProjectContent(content, 'a', 'jo', 1)).toBeUndefined()
    expect(deleteProjectContent(content, 'missing', 'jo', 0)).toBeUndefined()
    expect(content.actions).toHaveLength(1)
  })

  test('another participant or author blocks even the creator, including when node count is unchanged', () => {
    const sharedEmpty = state([graph('a', 'jo', ['lin'])])
    expect(deleteProjectContent(sharedEmpty, 'a', 'jo', 0)).toBeUndefined()
    const sharedActions = state([graph('a')], [node('1', 'a'), node('2', 'a', 'lin')])
    expect(deleteProjectContent(sharedActions, 'a', 'jo', 2)).toBeUndefined()
    expect(getProjectDeletionDisabledReason(sharedActions.projects[0], 'jo', sharedActions.actions)).toBe('已有其他用户参与，不能删除此图')
    expect(sharedActions.actions).toHaveLength(2)
  })

  test('deduplicates the current user and ignores other graphs when checking for another participant', () => {
    const ownGraph = graph('a', 'jo', ['jo', 'jo'])
    const actions = [node('1', 'a'), node('2', 'a'), node('3', 'b', 'lin')]
    expect(canDeleteProject(ownGraph, 'jo', actions)).toBe(true)
    expect(getProjectDeletionDisabledReason(ownGraph, 'jo', actions)).toBeUndefined()
    expect(deleteProjectContent(state([ownGraph, graph('b', 'lin')], actions), 'a', 'jo', 2)?.actions).toEqual([actions[2]])
  })
})

describe('graph content deletion', () => {
  test('a stale confirmation cannot silently delete newly added nodes', () => {
    const content = state([graph('a')], [node('1', 'a'), node('2', 'a')])
    expect(deleteProjectContent(content, 'a', 'jo', 0)).toBeUndefined()
    expect(deleteProjectContent(content, 'a', 'jo', 1)).toBeUndefined()
    expect(content.actions).toHaveLength(2)
    expect(deleteProjectContent(content, 'a', 'jo', 2)?.actions).toEqual([])
  })

  test('removes own nodes and legacy records in the selected graph, preserving the other graph', () => {
    const content = {
      ...state([graph('a'), graph('b')], [node('a1', 'a'), node('a2', 'a'), node('b1', 'b')]),
      topics: [{ id: 'ta', projectId: 'a' }, { id: 'tb', projectId: 'b' }],
      plans: [{ id: 'pa', topicId: 'ta' }, { id: 'pb', topicId: 'tb' }],
      completions: [{ id: 'ca', topicId: 'ta', planNodeId: 'pa' }, { id: 'cb', topicId: 'tb', planNodeId: 'pb' }],
      reactions: { ca: 'believe', cb: 'doubt', pa: null },
    }
    const snapshot = JSON.parse(JSON.stringify(content))
    const remaining = deleteProjectContent(content, 'a', 'jo', 2)
    expect(remaining).toEqual({
      projects: [content.projects[1]], actions: [content.actions[2]], topics: [content.topics[1]],
      plans: [content.plans[1]], completions: [content.completions[1]], reactions: { cb: 'doubt' },
    })
    expect(content).toEqual(snapshot)
  })

  test('deleting the last populated graph leaves no dangling records and a duplicate deletion fails', () => {
    const remaining = deleteProjectContent(state([graph('a')], [node('1', 'a')]), 'a', 'jo', 1)
    expect(remaining).toEqual(state([]))
    expect(deleteProjectContent(remaining, 'a', 'jo', 0)).toBeUndefined()
  })
})
