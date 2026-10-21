import type { FollowedSources } from '../../entities/following/model/types'

/** Demo subscriptions point to existing public graphs and profiles with published actions. */
export const initialFollowing: FollowedSources = {
  graphIds: ['cooking', 'daily', 'practice'],
  userIds: ['lin', 'miao', 'che', 'xiaoman', 'robin'],
}
