export type Gender = 'female' | 'male' | 'undisclosed'

export type Actor = {
  id: string
  name: string
  handle: string
  role: string
  bio?: string
  gender?: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}
