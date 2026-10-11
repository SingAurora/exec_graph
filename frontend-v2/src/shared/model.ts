export type AppView = 'home' | 'following' | 'publish' | 'my' | 'settings' | 'topic' | 'project' | 'projects'

export type AuthView = 'login' | 'register' | 'forgot'

export type UserProfile = {
  id: string
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
  avatar: string
  activeDays: number
  isTestAccount?: boolean
}

export type ActionTopic = {
  id: string
  projectId: string
  title: string
  description: string
  createdAt: string
}

export type Project = {
  id: string
  ownerId: string
  participantIds: string[]
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export type PlanNode = {
  id: string
  topicId: string
  authorId: string
  title: string
  description: string
  points: string[]
  markdown: string
  status: 'draft' | 'active' | 'completed'
  createdAt: string
}

export type CompletionNode = {
  id: string
  topicId: string
  planNodeId: string
  authorId: string
  title: string
  markdown: string
  believeCount: number
  doubtCount: number
  createdAt: string
}

export type Reaction = 'believe' | 'doubt' | null

export type ChatMessage = {
  id: string
  speaker: 'ai' | 'user'
  body: string
}

// Legacy shapes remain for the unused prototype components in this folder.
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
