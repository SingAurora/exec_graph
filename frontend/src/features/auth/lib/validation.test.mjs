import { describe, expect, test } from 'bun:test'
import { validateAuthField, validateAuthForm } from './validation.ts'

const form = (values) => {
  const data = new globalThis.FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe('account form validation', () => {
  test('login validates email and password without requiring registration fields', () => {
    expect(validateAuthForm('login', form({ email: 'name@example.com', password: 'old' }))).toEqual({})
    expect(Object.keys(validateAuthForm('login', form({})))).toEqual(['email', 'password'])
  })

  test('email feedback distinguishes missing and malformed values and allows surrounding whitespace', () => {
    expect(validateAuthField('login', 'email', '  ')).toBe('请输入邮箱地址')
    for (const value of ['name', 'name@', 'name@domain', 'name @example.com', 'name@@example.com']) {
      expect(validateAuthField('login', 'email', value)).toContain('有效的邮箱地址')
    }
    expect(validateAuthField('register', 'email', ' name+tag@example.com ')).toBeUndefined()
  })

  test('registration rejects whitespace-only nicknames and reports errors in field order', () => {
    const errors = validateAuthForm('register', form({ nickname: '  ', email: 'wrong', code: '12ab', password: '123' }))
    expect(Object.keys(errors)).toEqual(['nickname', 'email', 'code', 'password'])
    expect(errors.nickname).toBe('请输入昵称')
  })

  test('resetting a password requires a six-digit code and an eight-character password', () => {
    expect(validateAuthForm('forgot', form({ email: 'name@example.com', code: '012345', password: '12345678' }))).toEqual({})
    expect(validateAuthField('forgot', 'code', '12345')).toBe('请输入 6 位数字验证码')
    expect(validateAuthField('forgot', 'code', 'abcdef')).toBe('请输入 6 位数字验证码')
    expect(validateAuthField('forgot', 'password', '1234567')).toBe('密码至少需要 8 位')
  })
})
