import { getAPI } from '../../../shared/api/client'
import { BusinessRequestError } from '../../../shared/api/errors'
import { API_ERROR_CODES } from '../../../shared/api/contracts'
import { clearAuthToken } from '../../../shared/api/auth-token'
import type { UserProfile } from '../model/types'
import type { GraphView } from '../../graph/api/graphs'
import { actionFromView, type ActionContextNode, type VersionedAction } from '../../action/api/context'

/** 当前账户资料及版本，包含本人邮箱，仅由会话接口返回。 */
export type AccountProfile = UserProfile & { version: number }

/** 当前会话资料；认证使用 localStorage 中的 Bearer token。 */
export type SessionView = { user: AccountProfile; token?: string }

/** 侧栏使用的当前账号统计。 */
export type ProfileStats = { actions: number; expressions: number; agreements: number }

/** 账号统计缓存键，按用户隔离。 */
export const profileStatsKey = (userUuid: string) => ['profiles', userUuid, 'stats'] as const

/** 读取当前账号侧栏统计，不加载完整行动上下文。 */
export function readProfileStats(userUuid: string, signal?: AbortSignal): Promise<ProfileStats> {
  return getAPI('/api/commands/profiles/stats', { userUuid }, { signal })
}

/** 读取当前账户；真实服务无有效会话时应返回 10002，开发模拟固定为已登录账号。 */
export async function readSession(signal?: AbortSignal): Promise<SessionView | null> {
  try { return await getAPI('/api/commands/auth/session', {}, { signal }) }
  catch (error) {
    if (error instanceof BusinessRequestError && error.code === API_ERROR_CODES.unauthenticated) { clearAuthToken(); return null }
    throw error
  }
}

/** 单个主页内容的缓存键；按用户独立保存，切回已访问主页不互相覆盖。 */
export const profileContentKey = (userUuid: string) => ['profiles', userUuid, 'content'] as const

export type ProfileContent = {
  profile: UserProfile
  graphs: GraphView[]
  actions: VersionedAction[]
}

type ProfileContentResponse = {
  profile: UserProfile
  graphs: GraphView[]
  actions: ActionContextNode[]
}

/** 读取单个用户主页所需的图、行动和作者资料。 */
export async function readProfileContent(userUuid: string, signal?: AbortSignal): Promise<ProfileContent> {
  const data = await getAPI<ProfileContentResponse>('/api/commands/profiles/content', { userUuid }, { signal })
  return { ...data, actions: data.actions.map(actionFromView) }
}
