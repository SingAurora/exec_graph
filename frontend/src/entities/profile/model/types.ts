/** Public profile and current-account identity used by the static prototype. */
export type UserProfile = {
  id: string
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
  avatar: string
  backgroundImage?: string
  activeDays: number
  isTestAccount?: boolean
}
