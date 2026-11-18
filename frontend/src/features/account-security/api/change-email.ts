import { postAPI } from '../../../shared/api/client'

export type ChangeEmailInput = {
  currentPassword: string
  code: string
  email: string
}

/** 修改绑定邮箱；服务端验证后撤销该账号的全部旧会话。 */
export function changeEmail(input: ChangeEmailInput): Promise<null> {
  return postAPI('/api/commands/auth/email-change', input)
}
