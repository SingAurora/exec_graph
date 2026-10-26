import { getAPI } from '../../../shared/api/client'
import { BusinessRequestError } from '../../../shared/api/errors'
import { API_ERROR_CODES } from '../../../shared/api/contracts'
import type { UserProfile } from '../model/types'

/** 当前账户资料及版本，包含本人邮箱，仅由会话接口返回。 */
export type AccountProfile = UserProfile & { version: number }

/** 公开用户 DTO；Omit 从现有类型排除邮箱和演示账户标记。 */
export type PublicProfileView = Omit<UserProfile, 'email' | 'isTestAccount'>

/** 当前会话资料及业务写入所需的 CSRF token。 */
export type SessionView = { user: AccountProfile; csrfToken: string }

/** 会话与公开用户目录的缓存键；公开目录按当前账号作用域隔离。 */
export const profileKeys = {
  session: ['session'] as const,
  catalogue: (scope: string) => ['profiles', scope, 'catalogue'] as const,
}

/** 读取当前账户；真实服务无有效会话时应返回 10002，开发模拟固定为已登录账号。 */
export async function readSession(signal?: AbortSignal): Promise<SessionView | null> {
  try { return await getAPI('/api/commands/auth/session', {}, { signal }) }
  catch (error) {
    if (error instanceof BusinessRequestError && error.code === API_ERROR_CODES.unauthenticated) return null
    throw error
  }
}

/** 读取公开用户目录，为作者展示、资料预览和用户筛选提供数据。 */
export function readProfileCatalogue(signal?: AbortSignal): Promise<PublicProfileView[]> {
  return getAPI('/api/commands/profiles/catalogue', {}, { signal })
}
