import { describe, expect, test } from 'bun:test'
import { URLSearchParams } from 'node:url'
import { actionWorkspaceHash, readActionWorkspaceRoute } from './action-workspace-route.ts'

describe('persistent workspace addresses', () => {
  test('refresh restores first actions, continuations and expression editing to the same target', () => {
    for (const target of [
      { mode: 'action', projectId: 'cooking', parentId: undefined },
      { mode: 'action', projectId: 'cooking', parentId: 'node/#9' },
      { mode: 'expression', projectId: 'graph & space', nodeId: 'node-14' },
    ]) {
      expect(readActionWorkspaceRoute(new URLSearchParams(actionWorkspaceHash(target).split('?')[1]))).toEqual(target)
    }
  })
  test('incomplete editor URLs cannot silently turn expression editing into a new action', () => {
    expect(readActionWorkspaceRoute(new URLSearchParams('mode=expression&projectId=cooking'))).toBeUndefined()
    expect(readActionWorkspaceRoute(new URLSearchParams('mode=action'))).toBeUndefined()
    expect(readActionWorkspaceRoute(new URLSearchParams('projectId=cooking&mode=invalid'))).toBeUndefined()
  })
})
