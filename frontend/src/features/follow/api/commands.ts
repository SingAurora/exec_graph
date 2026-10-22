import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { FollowedSources } from '../../../entities/following/model/types'

/** Sets a subscription explicitly, so repeated clicks do not toggle an unknown state. */
export function setFollowing(input: { kind: 'user' | 'graph'; targetId: string; following: boolean }, options: BusinessRequestOptions): Promise<FollowedSources> {
  return postAPI('/api/commands/following/set', input, options)
}
