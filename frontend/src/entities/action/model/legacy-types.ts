import type { ChatMessage, PostImage } from '../../../shared/model/content'

// Compatibility models for the earlier plan/completion prototype. New action flows use types.ts.

/** Legacy topic grouping retained for reading earlier prototype records. */
export type ActionTopic = {
  id: string
  projectId: string
  title: string
  description: string
  createdAt: string
}

/** Legacy plan document, separate from the current action-node model. */
export type PlanNode = {
  id: string
  topicId: string
  authorId: string
  parentPlanId?: string
  branchId?: string
  branchTitle?: string
  title: string
  description: string
  points: string[]
  markdown: string
  images?: PostImage[]
  conversation?: ChatMessage[]
  status: 'draft' | 'active' | 'completed'
  createdAt: string
}

/** Legacy archive's document and conversation views. */
export type ArchiveTab = 'plan' | 'history'

/** Legacy completed-plan document retained for earlier archive readers. */
export type CompletionNode = {
  id: string
  topicId: string
  planNodeId: string
  authorId: string
  title: string
  markdown: string
  images?: PostImage[]
  conversation?: ChatMessage[]
  believeCount: number
  doubtCount: number
  createdAt: string
}

/** Legacy feedback attached to a completed-plan record. */
export type Reaction = 'believe' | 'doubt' | null

/** Legacy lightweight action card. */
export type Action = {
  id: string
  title: string
  description: string
  points: string[]
  createdAt: string
}

/** Legacy calendar record. */
export type CompletionRecord = {
  id: string
  title: string
  note: string
  day: string
  month: string
}

/** Legacy discovery card kept separate from the current expression and agreement feeds. */
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
