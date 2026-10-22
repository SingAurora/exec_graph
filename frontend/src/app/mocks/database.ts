import { demoActions } from '../demo/actions'
import { currentUser, initialProjects, lin, miao } from '../demo/catalog'
import { cookingParticipants } from '../demo/cooking/participants'
import { initialFollowing } from '../demo/following'
import type { ActionNode } from '../../entities/action/model/types'
import type { GraphView } from '../../entities/project/api/graphs'
import type { AccountProfile } from '../../entities/profile/api/profiles'
import type { FollowedSources } from '../../entities/following/model/types'

/** Server-owned simulation state; only the application mock boundary imports fixed seeds. */
export type MockDatabase = {
  graphs: GraphView[]
  actions: (ActionNode & { version: number })[]
  users: AccountProfile[]
  following: FollowedSources
  csrfToken: string
  submissions: Map<string, { fingerprint: string; data: unknown; createdAt: number }>
}

/** Starts a fresh, nonpersistent demo server session, retaining existing fixture IDs for old URLs. */
export function createMockDatabase(): MockDatabase {
  return {
    graphs: structuredClone(initialProjects).map((graph) => ({ ...graph, version: 1 })),
    actions: structuredClone(demoActions).map((node) => ({ ...node, version: 1 })),
    users: structuredClone([currentUser, lin, miao, ...cookingParticipants]).map((user) => ({ ...user, version: 1 })),
    following: structuredClone(initialFollowing), csrfToken: crypto.randomUUID(), submissions: new Map(),
  }
}

/** The prototype's pre-authenticated demo account; real authentication remains a backend task. */
export function mockAccount(db: MockDatabase): AccountProfile { return db.users[0] }
