import { getAPI } from '../../../shared/api/client'
import type { FollowedSources } from '../model/types'
import type { GraphView } from '../../graph/api/graphs'
import type { UserProfile } from '../../profile/model/types'
import { actionFromView, type ActionContextNode, type VersionedAction } from '../../action/api/context'

/** Account-scoped subscription cache identity. */
export const followingKeys = { sources: (scope: string) => ['following', scope] as const }

/** Reads the current user's subscriptions. */
export function readFollowing(signal?: AbortSignal): Promise<FollowedSources> {
  return getAPI('/api/commands/following/source/getList', {}, { signal })
}

export type FollowingActionPage = {
  items: VersionedAction[]
  actions: VersionedAction[]
  graphs: GraphView[]
  total: number
  hasMore: boolean
}

export type FollowingGraphPage = { items: GraphView[]; total: number }
export type FollowingUserPage = { items: UserProfile[]; total: number }

export const followingTabKeys = {
  expressions: (scope: string) => ['following', scope, 'expressions'] as const,
  agreements: (scope: string) => ['following', scope, 'agreements'] as const,
  graphs: (scope: string) => ['following', scope, 'graphs'] as const,
  users: (scope: string) => ['following', scope, 'users'] as const,
}

function actionPage(path: `/api/commands/${string}/${string}`, signal?: AbortSignal) {
  return getAPI<{ items: ActionContextNode[]; actions: ActionContextNode[]; graphs: GraphView[]; total: number; hasMore: boolean }>(path, { page: 1, pageSize: 50 }, { signal })
    .then((data) => ({ items: data.items.map(actionFromView), actions: data.actions.map(actionFromView), graphs: data.graphs, total: data.total, hasMore: data.hasMore }))
}

export function readFollowingExpressions(signal?: AbortSignal): Promise<FollowingActionPage> {
  return actionPage('/api/commands/following/expression/getList', signal)
}

export function readFollowingAgreements(signal?: AbortSignal): Promise<FollowingActionPage> {
  return actionPage('/api/commands/following/agreement/getList', signal)
}

export function readFollowingGraphs(signal?: AbortSignal): Promise<FollowingGraphPage> {
  return getAPI('/api/commands/following/graph/getList', { page: 1, pageSize: 50 }, { signal })
}

export function readFollowingUsers(signal?: AbortSignal): Promise<FollowingUserPage> {
  return getAPI('/api/commands/following/user/getList', { page: 1, pageSize: 50 }, { signal })
}
