import type { Project } from '../../../shared/model'

/** Public graph activity calculated from published action nodes. */
export type GraphActivity = {
  project: Project
  actionCount: number
  expressionCount: number
  participantCount: number
  lastActionAt?: string
}
