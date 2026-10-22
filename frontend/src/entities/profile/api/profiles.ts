import { getAPI } from '../../../shared/api/client'
import type { UserProfile } from '../model/types'

/** Current-account profile returned only by the session endpoint. */
export type AccountProfile = UserProfile & { version: number }

/** Public profile DTO never contains the private account email. */
export type PublicProfileView = Omit<UserProfile, 'email' | 'isTestAccount'>

/** Server session identity and the CSRF token for business writes. */
export type SessionView = { user: AccountProfile; csrfToken: string }

/** Session and public directory cache identities. */
export const profileKeys = {
  session: ['session'] as const,
  catalogue: (scope: string) => ['profiles', scope, 'catalogue'] as const,
}

/** Reads the current authenticated account; unavailable sessions reject with code 10002. */
export function readSession(signal?: AbortSignal): Promise<SessionView> {
  return getAPI('/api/commands/auth/session', {}, { signal })
}

/** Reads public identities for the existing profile and author selectors. */
export function readProfileCatalogue(signal?: AbortSignal): Promise<PublicProfileView[]> {
  return getAPI('/api/commands/profiles/catalogue', {}, { signal })
}
