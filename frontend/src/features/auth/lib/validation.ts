import type { AuthView } from '../../../shared/lib/navigation'
import { validateEmail, validateNewPassword } from '../../../entities/account/lib/validation'
import { validateNickname } from '../../../entities/profile/lib/name-validation'

export type AuthFieldName = 'nickname' | 'email' | 'code' | 'password'
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>

/** Validates only the fields used by the current account form. */
export function validateAuthField(view: AuthView, name: AuthFieldName, value: string): string | undefined {
  switch (name) {
    case 'nickname':
      if (view !== 'register') return
      return validateNickname(value)
    case 'email':
      return validateEmail(value)
    case 'code':
      if (view === 'login') return
      if (!value.trim()) return '请输入邮箱验证码'
      if (!/^\d{6}$/.test(value.trim())) return '请输入 6 位数字验证码'
      return
    case 'password':
      if (!value) return view === 'forgot' ? '请设置新密码' : view === 'register' ? '请设置密码' : '请输入密码'
      // 登录只验证已有密码，不把新的字符限制追溯到旧账号。
      if (view !== 'login') return validateNewPassword(value)
      return
  }
}

/** Collects errors in visual field order so submission can focus the first one. */
export function validateAuthForm(view: AuthView, values: FormData): AuthFieldErrors {
  const fields: AuthFieldName[] = ['nickname', 'email', 'code', 'password']
  return Object.fromEntries(fields.flatMap((name) => {
    const error = validateAuthField(view, name, String(values.get(name) ?? ''))
    return error ? [[name, error]] : []
  }))
}
