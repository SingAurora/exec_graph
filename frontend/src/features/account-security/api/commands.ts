import { postAPI } from '../../../shared/api/client'

/** 修改认证信息后，服务端撤销该账号的全部旧会话。 */
export function changeCredentials(kind: 'email' | 'password', input: { currentPassword: string; code: string; email?: string; password?: string }, csrfToken: string): Promise<null> {
  return postAPI(kind === 'email' ? '/api/commands/auth/email-change' : '/api/commands/auth/password-change', input, { csrfToken })
}
