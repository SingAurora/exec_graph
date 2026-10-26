import { demoActions } from '../demo/actions'
import { currentUser, initialProjects, lin, miao } from '../demo/catalog'
import { cookingParticipants } from '../demo/cooking/participants'
import { initialFollowing } from '../demo/following'
import type { ActionNode } from '../../entities/action/model/types'
import type { GraphView } from '../../entities/project/api/graphs'
import type { AccountProfile } from '../../entities/profile/api/profiles'
import type { FollowedSources } from '../../entities/following/model/types'
import type { GenerateInput, GenerationView } from '../../features/action-generation/api/generation'
import type { ChatMessage } from '../../shared/model/content'

/** 仅显式模拟环境使用的模型结果，和真实生成使用同一个公开 DTO。 */
export type MockGeneration = { input: GenerateInput; view: GenerationView; messages: ChatMessage[]; used: boolean }

/** 模拟服务持有的会话状态；固定种子仅在 app 层注入，界面仍通过 HTTP 读取。 */
export type MockDatabase = {
  generations: Map<string, MockGeneration>
  nextGenerationDraft?: NonNullable<GenerationView['draft']>
  graphs: GraphView[]
  actions: (ActionNode & { version: number })[]
  users: AccountProfile[]
  following: FollowedSources
  csrfToken: string
  submissions: Map<string, { fingerprint: string; data: unknown; createdAt: number }>
}

/** 从演示种子复制新会话，刷新即重置；保留原有短 ID 兼容链接，不代表云端持久化。 */
export function createMockDatabase(): MockDatabase {
  return {
    generations: new Map(),
    graphs: structuredClone(initialProjects).map((graph) => ({ ...graph, version: 1 })),
    actions: structuredClone(demoActions).map((node) => ({ ...node, version: 1 })),
    users: structuredClone([currentUser, lin, miao, ...cookingParticipants]).map((user) => ({ ...user, version: 1 })),
    following: structuredClone(initialFollowing), csrfToken: crypto.randomUUID(), submissions: new Map(),
  }
}

/** 原型固定使用已登录的演示账号；这里没有实现真实账户认证。 */
export function mockAccount(db: MockDatabase): AccountProfile { return db.users[0] }
