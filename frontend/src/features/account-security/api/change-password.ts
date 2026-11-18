import { postAPI } from '../../../shared/api/client'

export type ChangePasswordInput = {
  currentPassword: string
  code: string
  password: string
}

/** 修改密码；服务端验证后撤销该账号的全部旧会话。 */
export function changePassword(input: ChangePasswordInput): Promise<null> {
  return postAPI('/api/commands/auth/password-change', input)
}
