import type { AuthView } from '../../../shared/model'

export type AuthFieldName = 'nickname' | 'email' | 'code' | 'password'
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>

const nicknameMaxLength = 30
const passwordMinLength = 8
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validates only the fields used by the current account form. */
export function validateAuthField(view: AuthView, name: AuthFieldName, value: string): string | undefined {
  switch (name) {
    case 'nickname':
      if (view !== 'register') return
      if (!value.trim()) return '请输入昵称'
      if (value.trim().length > nicknameMaxLength) return `昵称最多 ${nicknameMaxLength} 个字`
      return
    case 'email':
      if (!value.trim()) return '请输入邮箱地址'
      if (!emailPattern.test(value.trim())) return '请输入有效的邮箱地址，如 name@example.com'
      return
    case 'code':
      if (view === 'login') return
      if (!value.trim()) return '请输入邮箱验证码'
      if (!/^\d{6}$/.test(value.trim())) return '请输入 6 位数字验证码'
      return
    case 'password':
      if (!value) return view === 'forgot' ? '请设置新密码' : view === 'register' ? '请设置密码' : '请输入密码'
      if (view !== 'login' && value.length < passwordMinLength) return `密码至少需要 ${passwordMinLength} 位`
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
