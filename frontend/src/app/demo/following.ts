import type { FollowedSources } from '../../entities/following/model/types'

/** Demo subscriptions point to existing public graphs and profiles with published actions. */
export const initialFollowing: FollowedSources = {
  graphUuids: ['cooking', 'daily', 'practice'],
  userUuids: ['lin', 'miao', 'che', 'xiaoman', 'robin'],
}
