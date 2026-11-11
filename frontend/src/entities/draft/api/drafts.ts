import { getAPI, postAPI } from '../../../shared/api/client'

export type DraftScope = {
  type: 'action' | 'expression' | 'agreement'
  graphUuid: string
  nodeUuid?: string
  parentUuid?: string
}

export type CloudDraft = {
  uuid: string
  version: number
  payload: unknown
  lastAccessedAt: string
}

export const draftKeys = {
  detail: (scope: DraftScope) => ['drafts', scope.type, scope.graphUuid, scope.nodeUuid ?? '', scope.parentUuid ?? ''] as const,
}

function scopeQuery(scope: DraftScope) {
  return {
    type: scope.type,
    graphUuid: scope.graphUuid,
    nodeUuid: scope.nodeUuid,
    parentUuid: scope.parentUuid,
  }
}

export function readDraft(scope: DraftScope, signal?: AbortSignal): Promise<CloudDraft | null> {
  return getAPI('/api/commands/drafts/getInfo', scopeQuery(scope), { signal })
}

export function saveDraft(scope: DraftScope, payload: unknown, assetUuids: string[], expectedVersion: number): Promise<CloudDraft> {
  return postAPI('/api/commands/drafts/save', { scope, payload, assetUuids, expectedVersion })
}

export function deleteDraft(scope: DraftScope): Promise<null> {
  return postAPI('/api/commands/drafts/delete', { scope })
}
