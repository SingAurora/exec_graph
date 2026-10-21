/** A public action graph, whose creation is independent from its first action. */
export type Project = {
  id: string
  ownerId: string
  participantIds: string[]
  title: string
  description: string
  avatar?: string
  backgroundImage?: string
  createdAt: string
  updatedAt: string
  contextGuide?: string
}

/** Public graph activity calculated from published action nodes. */
export type GraphActivity = {
  project: Project
  actionCount: number
  expressionCount: number
  participantCount: number
  lastActionAt?: string
}
