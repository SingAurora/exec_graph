import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { SessionView } from '../../../entities/profile/api/profiles'

/** 邮件验证码按用途隔离，账户修改还必须绑定当前会话。 */
export type CodePurpose = 'register' | 'reset-password' | 'change-password' | 'change-email'
/** 邮件服务只返回有效期与重发间隔。 */
export type CodeView = { expiresIn: number; retryAfter: number }

/** 密码登录，由服务端设置 HttpOnly 会话 cookie。 */
export function login(email: string, password: string): Promise<SessionView> {
  return postAPI('/api/commands/auth/login', { email, password })
}
/** 显式测试入口，是否允许登录测试号最终由服务端配置决定。 */
export function demoLogin(): Promise<SessionView> { return postAPI('/api/commands/auth/demo-login', {}) }
/** 撤销服务端会话。 */
export function logout(csrfToken: string): Promise<null> { return postAPI('/api/commands/auth/logout', {}, { csrfToken }) }
/** 请求真实邮件验证码。 */
export function sendCode(purpose: CodePurpose, email: string, options: BusinessRequestOptions = {}): Promise<CodeView> {
  return postAPI('/api/commands/auth/code-send', { purpose, email }, { ...options, timeoutMs: 30_000 })
}
/** 验证邮箱并创建普通账号，不接受测试账号标记。 */
export function register(input: { email: string; code: string; password: string; name: string }): Promise<SessionView> {
  return postAPI('/api/commands/auth/register', input)
}
/** 验证绑定邮箱后重设密码，撤销旧会话。 */
export function resetPassword(input: { email: string; code: string; password: string }): Promise<null> {
  return postAPI('/api/commands/auth/password-reset', input)
}
