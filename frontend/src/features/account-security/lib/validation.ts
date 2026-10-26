import { validateEmail, validateNewPassword } from '../../../entities/account/lib/validation'

export type SecurityFormKind = 'email' | 'password'
export type SecurityFieldName = 'email' | 'code' | 'currentPassword' | 'password' | 'confirmation'
export type SecurityFieldErrors = Partial<Record<SecurityFieldName, string>>

const fieldOrder: Record<SecurityFormKind, SecurityFieldName[]> = {
  email: ['email', 'code', 'currentPassword'],
  password: ['currentPassword', 'password', 'confirmation', 'code'],
}

/** Validates a new email without invoking the browser's native error bubble. */
export function validateNewEmail(value: string, currentEmail: string): string | undefined {
  if (!value.trim()) return '请输入新邮箱'
  const error = validateEmail(value)
  if (error) return error
  if (value.trim().toLowerCase() === currentEmail.trim().toLowerCase()) return '新邮箱不能与当前邮箱相同'
}

/** Validates account changes in display order, including the verification destination. */
export function validateSecurityForm(kind: SecurityFormKind, fields: FormData, currentEmail: string, codeTarget: string): SecurityFieldErrors {
  const value = (name: SecurityFieldName) => String(fields.get(name) ?? '')
  const errors: SecurityFieldErrors = {}
  for (const name of fieldOrder[kind]) {
    switch (name) {
      case 'email':
        errors.email = validateNewEmail(value(name), currentEmail)
        break
      case 'code': {
        const destination = kind === 'email' ? value('email') : currentEmail
        if (!codeTarget || codeTarget !== destination.trim().toLowerCase()) errors.code = kind === 'email' ? '请先向新邮箱发送验证码' : '请先向绑定邮箱发送验证码'
        else if (!/^\d{6}$/.test(value(name).trim())) errors.code = '请输入 6 位数字验证码'
        break
      }
      case 'currentPassword':
        if (!value(name)) errors.currentPassword = '请输入当前密码'
        break
      case 'password':
        errors.password = validateNewPassword(value(name))
        if (!errors.password && value(name) === value('currentPassword')) errors.password = '新密码不能与当前密码相同'
        break
      case 'confirmation':
        if (!value(name)) errors.confirmation = '请再次输入新密码'
        else if (value(name) !== value('password')) errors.confirmation = '两次输入的密码不一致'
        break
    }
  }
  return Object.fromEntries(Object.entries(errors).filter(([, error]) => error))
}
