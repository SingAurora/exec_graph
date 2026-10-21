import { useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { useToast } from '../../../shared/ui/toast/useToast'
import { SecurityField } from './SecurityField'
import { validateNewEmail, validateSecurityForm, type SecurityFieldErrors, type SecurityFieldName, type SecurityFormKind } from '../lib/validation'

type SecurityFormProps = {
  kind: SecurityFormKind
  email: string
  countdown: number
  onRequestCode: () => void
  onCancel: () => void
}

/** Validates a single account change while retaining its draft across settings tabs. */
export function SecurityForm({ kind, email, countdown, onRequestCode, onCancel }: SecurityFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<SecurityFieldErrors>({})
  const [codeTarget, setCodeTarget] = useState('')
  const [resetVersion, setResetVersion] = useState(0)
  const { showToast } = useToast()
  const isEmail = kind === 'email'
  const focusField = (name: string) => {
    const input = formRef.current?.elements.namedItem(name)
    if (input instanceof HTMLInputElement) input.focus()
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateSecurityForm(kind, new FormData(event.currentTarget), email, codeTarget)
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) { focusField(firstError); return }
    event.currentTarget.reset()
    setCodeTarget('')
    setResetVersion((version) => version + 1)
    showToast({ kind: 'info', message: `演示：表单校验通过，未实际修改${isEmail ? '邮箱' : '密码'}` })
  }
  const sendCode = () => {
    if (countdown > 0 || !formRef.current) return
    const fields = new FormData(formRef.current)
    const destination = (isEmail ? String(fields.get('email') ?? '') : email).trim().toLowerCase()
    const error = isEmail ? validateNewEmail(destination, email) : undefined
    setErrors((current) => ({ ...current, email: error }))
    if (error) { focusField('email'); return }
    setCodeTarget(destination)
    setErrors((current) => ({ ...current, code: undefined }))
    onRequestCode()
    showToast({ kind: 'info', message: `演示：向${isEmail ? '新邮箱' : '绑定邮箱'}发送验证码，未实际发送邮件` })
    focusField('code')
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

  return <form ref={formRef} className="grid gap-4" aria-label={isEmail ? '修改邮箱' : '修改密码'} noValidate onSubmit={submit} onChange={updateErrors} onBlur={updateErrors}>
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
  </form>
}
