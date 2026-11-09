import { getAPI } from '../../../shared/api/client'
import type { FollowedSources } from '../model/types'

/** Account-scoped subscription cache identity. */
export const followingKeys = { sources: (scope: string) => ['following', scope] as const }

/** Reads the current user's subscriptions. */
export function readFollowing(signal?: AbortSignal): Promise<FollowedSources> {
  return getAPI('/api/commands/following/sources', {}, { signal })
}

/** 关注页数据：关注集合与相关图和行动子图一次返回。 */
export type FollowingContent = {
  sources: FollowedSources
  graphs: import('../../graph/api/graphs').GraphView[]
  actions: import('../../action/api/context').VersionedAction[]
}

export const followingContentKey = (scope: string) => ['following', scope, 'content'] as const

export async function readFollowingContent(signal?: AbortSignal): Promise<FollowingContent> {
  const data = await getAPI<{ sources: FollowedSources; graphs: import('../../graph/api/graphs').GraphView[]; actions: import('../../action/api/context').ActionContextNode[] }>('/api/commands/following/content', {}, { signal })
  const { actionFromView } = await import('../../action/api/context')
  return { sources: data.sources, graphs: data.graphs, actions: data.actions.map(actionFromView) }
}
