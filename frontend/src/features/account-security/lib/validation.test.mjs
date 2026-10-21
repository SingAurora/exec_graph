import { describe, expect, test } from 'bun:test'
import { validateNewEmail, validateSecurityForm } from './validation.ts'

const form = (values) => {
  const fields = new globalThis.FormData()
  for (const [key, value] of Object.entries(values)) fields.set(key, value)
  return fields
}
const email = 'old@example.com'

describe('account security validation', () => {
  test('email must be valid and different from the bound address, ignoring case', () => {
    expect(validateNewEmail('', email)).toBe('请输入新邮箱')
    expect(validateNewEmail('wrong@address', email)).toContain('有效的邮箱地址')
    expect(validateNewEmail(' OLD@example.com ', email)).toContain('不能与当前邮箱相同')
    expect(validateNewEmail(' new@example.com ', email)).toBeUndefined()
  })

  test('changing the new email invalidates a previously requested code', () => {
    const fields = form({ email: 'new@example.com', code: '123456', currentPassword: 'secret' })
    expect(validateSecurityForm('email', fields, email, '')).toEqual({ code: '请先向新邮箱发送验证码' })
    expect(validateSecurityForm('email', fields, email, 'other@example.com')).toEqual({ code: '请先向新邮箱发送验证码' })
    expect(validateSecurityForm('email', fields, email, 'new@example.com')).toEqual({})
  })

  test('email errors are returned in visual order for focus management', () => {
    expect(Object.keys(validateSecurityForm('email', form({}), email, ''))).toEqual(['email', 'code', 'currentPassword'])
  })

  test('password changes require the current password and a matching new password', () => {
    const valid = { currentPassword: 'oldsecret', password: 'newsecret', confirmation: 'newsecret', code: '012345' }
    expect(validateSecurityForm('password', form(valid), email, email)).toEqual({})
    expect(validateSecurityForm('password', form({ ...valid, currentPassword: '' }), email, email).currentPassword).toBeTruthy()
    expect(validateSecurityForm('password', form({ ...valid, password: 'short' }), email, email).password).toContain('8 位')
    expect(validateSecurityForm('password', form({ ...valid, confirmation: 'different' }), email, email).confirmation).toContain('不一致')
    expect(validateSecurityForm('password', form({ ...valid, password: 'oldsecret', confirmation: 'oldsecret' }), email, email).password).toContain('不能与当前密码相同')
  })

  test('verification requires six digits and a request to the current bound email', () => {
    const valid = { currentPassword: 'oldsecret', password: 'newsecret', confirmation: 'newsecret', code: '012345' }
    expect(validateSecurityForm('password', form(valid), email, 'another@example.com').code).toContain('先向绑定邮箱')
    for (const code of ['', '12345', '1234567', '12abcd']) {
      expect(validateSecurityForm('password', form({ ...valid, code }), email, email).code).toContain('6 位数字')
    }
    expect(Object.keys(validateSecurityForm('password', form({}), email, ''))).toEqual(['currentPassword', 'password', 'confirmation', 'code'])
  })
})
