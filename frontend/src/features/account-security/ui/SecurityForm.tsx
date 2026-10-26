import { useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { useToast } from '../../../shared/ui/toast/useToast'
import { SecurityField } from './SecurityField'
import { sendCode as requestCode } from '../../auth/api/account'
import { changeCredentials } from '../api/commands'
import { useQueryClient } from '@tanstack/react-query'
import { profileKeys } from '../../../entities/profile/api/profiles'
import { validateNewEmail, validateSecurityForm, type SecurityFieldErrors, type SecurityFieldName, type SecurityFormKind } from '../lib/validation'

type SecurityFormProps = {
  kind: SecurityFormKind
  email: string
  countdown: number
  csrfToken: string
  onRequestCode: () => void
  onCancel: () => void
}

/** Validates a single account change while retaining its draft across settings tabs. */
export function SecurityForm({ kind, email, countdown, csrfToken, onRequestCode, onCancel }: SecurityFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<SecurityFieldErrors>({})
  const [codeTarget, setCodeTarget] = useState('')
  const resetVersion = 0
  const [pending, setPending] = useState(false)
  const [codeSending, setCodeSending] = useState(false)
  const client = useQueryClient()
  const { showToast } = useToast()
  const isEmail = kind === 'email'
  const focusField = (name: string) => {
    const input = formRef.current?.elements.namedItem(name)
    if (input instanceof HTMLInputElement) input.focus()
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || codeSending) return
    const fields = new FormData(event.currentTarget)
    const nextErrors = validateSecurityForm(kind, fields, email, codeTarget)
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) { focusField(firstError); return }
    setPending(true)
    try {
      await changeCredentials(kind, { currentPassword: String(fields.get('currentPassword')), code: String(fields.get('code')).trim(),
        ...(isEmail ? { email: String(fields.get('email')).trim().toLowerCase() } : { password: String(fields.get('password')) }) }, csrfToken)
      await client.cancelQueries()
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      client.setQueryData(profileKeys.session, null)
      window.location.hash = 'login'
      showToast({ kind: 'info', message: `${isEmail ? '邮箱' : '密码'}已更新，请重新登录` })
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '修改失败，请重试' }) }
    finally { setPending(false) }
  }
  const sendCode = async () => {
    if (countdown > 0 || pending || codeSending || !formRef.current) return
    const fields = new FormData(formRef.current)
    const destination = (isEmail ? String(fields.get('email') ?? '') : email).trim().toLowerCase()
    const error = isEmail ? validateNewEmail(destination, email) : undefined
    setErrors((current) => ({ ...current, email: error }))
    if (error) { focusField('email'); return }
    setCodeSending(true)
    try {
      await requestCode(isEmail ? 'change-email' : 'change-password', destination, { csrfToken })
      setCodeTarget(destination)
      setErrors((current) => ({ ...current, code: undefined }))
      onRequestCode()
      showToast({ kind: 'info', message: '验证码已发送，请查收邮箱' })
      focusField('code')
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '发送失败，请重试' }) }
    finally { setCodeSending(false) }
  }
  const updateErrors = (event: FormEvent<HTMLFormElement> | FocusEvent<HTMLFormElement>) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const name = input.name as SecurityFieldName
    const destinationChanged = isEmail && name === 'email' && event.type === 'change'
    if (destinationChanged) {
      setCodeTarget('')
      const code = event.currentTarget.elements.namedItem('code')
      if (code instanceof HTMLInputElement) code.value = ''
    }
    const nextErrors = validateSecurityForm(kind, new FormData(event.currentTarget), email, destinationChanged ? '' : codeTarget)
    setErrors((current) => {
      const updated = { ...current }
      for (const field of Object.keys(current) as SecurityFieldName[]) {
        if (current[field]) updated[field] = nextErrors[field]
      }
      if (event.type === 'blur' && input.value) updated[name] = nextErrors[name]
      return updated
    })
  }
  const field = (name: SecurityFieldName) => ({ id: `security-${kind}-${name}`, name, error: errors[name] })

  return (
    <form ref={formRef} className="grid gap-4" noValidate onSubmit={submit} onChange={updateErrors} onBlur={updateErrors}>
      <fieldset className="contents" disabled={pending || codeSending}>
      {isEmail
        ? <SecurityField {...field('email')} label="新邮箱" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="输入新的邮箱地址" />
        : <>
          <SecurityField key={`current-${resetVersion}`} {...field('currentPassword')} label="当前密码" type="password" autoComplete="current-password" placeholder="输入当前密码" />
          <SecurityField key={`password-${resetVersion}`} {...field('password')} label="新密码" type="password" autoComplete="new-password" placeholder="至少 8 位，不能与当前密码相同" />
          <SecurityField key={`confirmation-${resetVersion}`} {...field('confirmation')} label="确认新密码" type="password" autoComplete="new-password" placeholder="再次输入新密码" />
        </>}
      <SecurityField {...field('code')} label={isEmail ? '新邮箱验证码' : '绑定邮箱验证码'} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 位数字验证码"
        action={<button className="quiet-button min-w-28 shrink-0 tabular-nums" type="button" disabled={countdown > 0} onClick={sendCode}>{countdown > 0 ? `${countdown}s 后重发` : codeTarget ? '重新发送' : '发送验证码'}</button>} />
      {isEmail && <SecurityField key={`current-${resetVersion}`} {...field('currentPassword')} label="当前密码" type="password" autoComplete="current-password" placeholder="输入当前密码" />}
      <div className="flex justify-end gap-3 pt-1"><button className="quiet-button min-h-9" type="button" onClick={onCancel}>取消</button><button className="primary-button" type="submit">{isEmail ? '更新邮箱' : '更新密码'}</button></div>
      </fieldset>
    </form>
  )
}
