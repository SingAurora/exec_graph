import { hasUnsafeTextCharacters, utf8Length } from '../../../shared/lib/text-input'

export const emailMaxBytes = 64
const passwordMinCharacters = 8
export const passwordMaxCharacters = 32

/** 邮箱按提交时的去首尾空白、转小写结果检查长度及基本格式。 */
export function validateEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase()
  if (!email) return '请输入邮箱地址'
  if (utf8Length(email) > emailMaxBytes) return `邮箱最多 ${emailMaxBytes} 个字符`
  if (hasUnsafeTextCharacters(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return '请输入有效的邮箱地址，如 name@example.com'
}

/** 仅校验新密码；只接受英文、数字和可见普通符号，不删除或改写输入。 */
export function validateNewPassword(value: string): string | undefined {
  if ([...value].length < passwordMinCharacters) return `密码至少需要 ${passwordMinCharacters} 位`
  if (utf8Length(value) > passwordMaxCharacters) return `密码最多 ${passwordMaxCharacters} 位`
  if (!/^[\x21-\x7e]+$/u.test(value)) return '密码只能包含英文、数字和普通符号，不能包含空格'
}
