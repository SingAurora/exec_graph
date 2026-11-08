import { describe, expect, test } from 'bun:test'
import { URLSearchParams } from 'node:url'
import { actionWorkspaceHash, readActionWorkspaceRoute } from './action-workspace-route.ts'

describe('persistent workspace addresses', () => {
  test('refresh restores first actions, continuations and expression editing to the same target', () => {
    for (const target of [
      { mode: 'action', graphUuid: 'cooking', parentUuid: undefined },
      { mode: 'action', graphUuid: 'cooking', parentUuid: 'node/#9' },
      { mode: 'expression', graphUuid: 'graph & space', nodeUuid: 'node-14' },
      { mode: 'agreement', graphUuid: 'graph & space', nodeUuid: 'node-14' },
    ]) {
      expect(readActionWorkspaceRoute(new URLSearchParams(actionWorkspaceHash(target).split('?')[1]))).toEqual(target)
    }
  })
  test('incomplete editor URLs cannot silently turn expression editing into a new action', () => {
    expect(readActionWorkspaceRoute(new URLSearchParams('mode=expression&graphUuid=cooking'))).toBeUndefined()
    expect(readActionWorkspaceRoute(new URLSearchParams('mode=action'))).toBeUndefined()
    expect(readActionWorkspaceRoute(new URLSearchParams('graphUuid=cooking&mode=invalid'))).toBeUndefined()
  })
})
