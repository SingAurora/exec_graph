import { getAPI } from '../../../shared/api/client'
import { BusinessRequestError } from '../../../shared/api/errors'
import { API_ERROR_CODES } from '../../../shared/api/contracts'
import { clearAuthToken } from '../../../shared/api/auth-token'
import type { UserProfile } from '../model/types'

/** 当前账户资料及版本，包含本人邮箱，仅由会话接口返回。 */
export type AccountProfile = UserProfile & { version: number }

/** 当前会话资料；认证使用 localStorage 中的 Bearer token。 */
export type SessionView = { user: AccountProfile; token?: string }

/** 读取当前账户；真实服务无有效会话时应返回 10002，开发模拟固定为已登录账号。 */
export async function readSession(signal?: AbortSignal): Promise<SessionView | null> {
  try { return await getAPI('/api/commands/auth/session', {}, { signal }) }
  catch (error) {
    if (error instanceof BusinessRequestError && error.code === API_ERROR_CODES.unauthenticated) { clearAuthToken(); return null }
    throw error
  }
}
