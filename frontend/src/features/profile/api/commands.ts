import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { AccountProfile } from '../../../entities/profile/api/profiles'
import type { UserProfile } from '../../../entities/profile/model/types'

/** Public profile changes exclude account identity and email. */
export type UpdateProfileInput = Pick<UserProfile, 'name' | 'gender' | 'bio' | 'avatar' | 'backgroundImage'> & { expectedVersion: number }

/** Saves the current account's public profile. */
export function updateProfile(input: UpdateProfileInput, options: BusinessRequestOptions): Promise<AccountProfile> {
  return postAPI('/api/commands/profiles/update', input, options)
}
