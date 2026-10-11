export type AppView = 'home' | 'today' | 'actions' | 'records' | 'following' | 'people' | 'settings'

export type AuthView = 'login' | 'register' | 'forgot'

export type Action = {
  id: string
  title: string
  description: string
  points: string[]
  createdAt: string
}

export type CompletionRecord = {
  id: string
  title: string
  note: string
  day: string
  month: string
}

export type UserProfile = {
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
  avatar: string
}

export type DiscoveryPost = {
  id: string
  name: string
  avatar: string
  avatarTone: 'blue' | 'coral'
  time: string
  title: string
  note: string
  following: boolean
}
