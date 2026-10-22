import { getAPI } from '../../../shared/api/client'
import type { FollowedSources } from '../model/types'

/** Account-scoped subscription cache identity. */
export const followingKeys = { sources: (scope: string) => ['following', scope] as const }

/** Reads the current user's subscriptions. */
export function readFollowing(signal?: AbortSignal): Promise<FollowedSources> {
  return getAPI('/api/commands/following/sources', {}, { signal })
}
