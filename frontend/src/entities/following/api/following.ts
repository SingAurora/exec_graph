import { getAPI } from '../../../shared/api/client'
import type { FollowedSources } from '../model/types'

/** Account-scoped subscription cache identity. */
export const followingKeys = { sources: (scope: string) => ['following', scope] as const }

/** Reads the current user's subscriptions. */
export function readFollowing(signal?: AbortSignal): Promise<FollowedSources> {
  return getAPI('/api/commands/following/source/getList', {}, { signal })
}

/** 关注页数据：关注集合与相关图和行动子图。 */
export type FollowingContent = {
  sources: FollowedSources
  graphs: import('../../graph/api/graphs').GraphView[]
  actions: import('../../action/api/context').VersionedAction[]
}

export const followingContentKey = (scope: string) => ['following', scope, 'content'] as const

type ActionPageResponse = {
  actions: import('../../action/api/context').ActionContextNode[]
  graphs: import('../../graph/api/graphs').GraphView[]
  total: number
}

type GraphPageResponse = { items: import('../../graph/api/graphs').GraphView[] }
type ProfilePageResponse = { items: import('../../profile/model/types').UserProfile[] }

async function followingActionPage(path: `/api/commands/${string}/${string}`, signal?: AbortSignal) {
  return getAPI<ActionPageResponse>(path, { page: 1, pageSize: 50 }, { signal })
}

export async function readFollowingContent(signal?: AbortSignal): Promise<FollowingContent> {
  const [sources, expressions, agreements, graphs, users] = await Promise.all([
    getAPI<FollowedSources>('/api/commands/following/source/getList', {}, { signal }),
    followingActionPage('/api/commands/following/expression/getList', signal),
    followingActionPage('/api/commands/following/agreement/getList', signal),
    getAPI<GraphPageResponse>('/api/commands/following/graph/getList', { page: 1, pageSize: 50 }, { signal }),
    getAPI<ProfilePageResponse>('/api/commands/following/user/getList', { page: 1, pageSize: 50 }, { signal }),
  ])
  const { actionFromView } = await import('../../action/api/context')
  const actionById = new Map<string, FollowingContent['actions'][number]>()
  for (const page of [expressions, agreements]) for (const node of page.actions) actionById.set(node.uuid, actionFromView(node))
  const graphById = new Map<string, FollowingContent['graphs'][number]>()
  for (const graph of [...graphs.items, ...expressions.graphs, ...agreements.graphs]) graphById.set(graph.uuid, graph)
  return {
    sources: { ...sources, users: [...new Map([...sources.users, ...users.items].map((user) => [user.uuid, user])).values()] },
    graphs: [...graphById.values()],
    actions: [...actionById.values()],
  }
}
