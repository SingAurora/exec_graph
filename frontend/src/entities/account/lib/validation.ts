import { hasUnsafeTextCharacters, hasWhitespace, utf8Length } from '../../../shared/lib/text-input'

const emailMaxBytes = 254
const passwordMinCharacters = 8
const passwordMaxBytes = 256

/** 邮箱按提交时的去首尾空白、转小写结果检查长度及基本格式。 */
export function validateEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase()
  if (!email) return '请输入邮箱地址'
  if (utf8Length(email) > emailMaxBytes) return `邮箱最多 ${emailMaxBytes} 字节`
  if (hasUnsafeTextCharacters(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return '请输入有效的邮箱地址，如 name@example.com'
}

/** 仅校验新密码；原样检查，不删除空白、转换大小写或修改 Unicode 组合。 */
export function validateNewPassword(value: string): string | undefined {
  if (hasWhitespace(value)) return '密码不能包含空格或其他空白字符'
  if (hasUnsafeTextCharacters(value)) return '密码不能包含控制字符或不可见格式字符'
  if ([...value].length < passwordMinCharacters) return `密码至少需要 ${passwordMinCharacters} 位`
  if (utf8Length(value) > passwordMaxBytes) return `密码最多 ${passwordMaxBytes} 字节`
}
