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

  test('nicknames count Unicode code points and reject hidden controls without rejecting joined emoji', () => {
    expect(validateAuthField('register', 'nickname', ` ${'😀'.repeat(30)} `)).toBeUndefined()
    expect(validateAuthField('register', 'nickname', '😀'.repeat(31))).toContain('30')
    expect(validateAuthField('register', 'nickname', '开发者👩‍💻')).toBeUndefined()
    for (const character of ['\n', '\t', '\u0000', '\u0085', '\u2028', '\u200b', '\u202e', '\u2066', '\ufeff']) {
      expect(validateAuthField('register', 'nickname', `小${character}明`)).toContain('字符')
    }
  })

  test('email limits apply to the normalized UTF-8 bytes', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`
    expect(validateAuthField('register', 'email', ` ${email.toUpperCase()} `)).toBeUndefined()
    expect(validateAuthField('login', 'email', `${email}x`)).toContain('254')
    expect(validateAuthField('forgot', 'email', `${'é'.repeat(122)}@example.com`)).toContain('254')
  })

  test('new passwords preserve visible symbols and Unicode while enforcing code point and byte limits', () => {
    for (const view of ['register', 'forgot']) {
      for (const password of ['Ab!\'"\\;9', '中文密码测试八位', '😀'.repeat(8), 'é'.repeat(128), '😀'.repeat(64), '开发者👩‍💻的密码']) {
        expect(validateAuthField(view, 'password', password)).toBeUndefined()
      }
      expect(validateAuthField(view, 'password', '😀'.repeat(7))).toContain('8 位')
      for (const password of ['a'.repeat(257), 'é'.repeat(129), '😀'.repeat(65)]) {
        expect(validateAuthField(view, 'password', password)).toContain('256')
      }
      for (const character of [' ', '\t', '\n', '\u00a0', '\u0085', '\u3000', '\u2028', '\u0000', '\u007f', '\u200b', '\u202e', '\u2066', '\ufeff']) {
        expect(validateAuthField(view, 'password', `pass${character}word`)).toContain('不能包含')
      }
    }
  })

  test('existing passwords remain unchanged and usable in login validation', () => {
    for (const password of ['old secret', ' password ', 'old\u200bsecret', '😀'.repeat(7)]) {
      expect(validateAuthField('login', 'password', password)).toBeUndefined()
    }
  })
})
