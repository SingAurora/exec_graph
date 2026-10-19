import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { useToast } from '../../../shared/ui/toast/useToast'

/** Email and password forms for the account security prototype. */
export function AccountSecurity({ email }: { email: string }) {
  const { showToast } = useToast()
  const emailInput = useRef<HTMLInputElement>(null)
  const [emailCodeTarget, setEmailCodeTarget] = useState('')
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [passwordCountdown, setPasswordCountdown] = useState(0)
  const [passwordCodeRequested, setPasswordCodeRequested] = useState(false)
  const countingDown = emailCountdown > 0 || passwordCountdown > 0

  useEffect(() => {
    if (!countingDown) return
    const timer = window.setInterval(() => {
      setEmailCountdown((seconds) => Math.max(0, seconds - 1))
      setPasswordCountdown((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countingDown])

  const validateNewEmail = () => {
    const input = emailInput.current
    if (!input) return false
    input.setCustomValidity(input.value.trim().toLowerCase() === email.trim().toLowerCase() ? '请输入与当前邮箱不同的新邮箱' : '')
    return input.reportValidity()
  }
  const sendEmailCode = () => {
    if (!validateNewEmail()) return
    setEmailCodeTarget(emailInput.current!.value.trim().toLowerCase())
    setEmailCountdown(60)
    showToast({ kind: 'info', message: '演示：向新邮箱发送验证码，未实际发送邮件' })
  }
  const sendPasswordCode = () => {
    setPasswordCodeRequested(true)
    setPasswordCountdown(60)
    showToast({ kind: 'info', message: '演示：向当前绑定邮箱发送验证码，未实际发送邮件' })
  }
  const changeEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateNewEmail()) return
    const newEmail = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    if (newEmail.toLowerCase() !== emailCodeTarget) {
      showToast({ kind: 'warning', message: '请先向新邮箱发送验证码' })
      return
    }
    event.currentTarget.reset()
    setEmailCodeTarget('')
    showToast({ kind: 'info', message: '演示：已完成表单校验，未实际验证身份或修改邮箱' })
  }
  const changePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const confirmation = form.elements.namedItem('confirmation') as HTMLInputElement
    if (fields.get('password') !== fields.get('confirmation')) {
      confirmation.setCustomValidity('两次输入的密码不一致')
      confirmation.reportValidity()
      return
    }
    if (!passwordCodeRequested) {
      showToast({ kind: 'warning', message: '请先向当前绑定邮箱发送验证码' })
      return
    }
    form.reset()
    setPasswordCodeRequested(false)
    showToast({ kind: 'info', message: '演示：已完成表单校验，未实际验证身份或修改密码' })
  }

  return <div className="mt-7 grid gap-8">
    <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8" aria-labelledby="change-email-title">
      <div>
        <div className="flex items-center gap-2"><h2 id="change-email-title" className="text-base font-semibold">修改邮箱</h2><HelpPopover title="账户服务"><p>修改邮箱需验证新邮箱并输入当前密码；修改密码需验证当前绑定邮箱。当前仅演示表单与发送倒计时，不校验真实密码或验证码，也不修改账户。</p></HelpPopover></div>
        <p className="mt-2 break-all text-sm text-muted">{email}</p>
      </div>
      <form className="grid gap-5" onSubmit={changeEmail}>
        <label className="form-field">新邮箱<input ref={emailInput} className="form-input" name="email" type="email" autoComplete="email" required placeholder="输入新的邮箱" onInput={(event) => {
          event.currentTarget.setCustomValidity('')
          setEmailCodeTarget('')
          const form = event.currentTarget.form
          const code = form?.elements.namedItem('code') as HTMLInputElement | null
          if (code) code.value = ''
        }} /></label>
        <VerificationCodeField id="email-change-code" countdown={emailCountdown} onSend={sendEmailCode} />
        <label className="form-field">当前密码<input className="form-input" name="currentPassword" type="password" autoComplete="current-password" required placeholder="输入当前密码" /></label>
        <div className="flex justify-end"><button className="quiet-button" type="submit">更新邮箱</button></div>
      </form>
    </section>
    <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8 border-t border-line pt-8" aria-labelledby="change-password-title">
      <div><h2 id="change-password-title" className="text-base font-semibold">修改密码</h2><p className="mt-2 break-all text-sm text-muted">{email}</p></div>
      <form className="grid gap-5" onSubmit={changePassword} onInput={(event) => {
        const confirmation = event.currentTarget.elements.namedItem('confirmation') as HTMLInputElement
        confirmation.setCustomValidity('')
      }}>
        <label className="form-field">当前密码<input className="form-input" name="currentPassword" type="password" autoComplete="current-password" required placeholder="输入当前密码" /></label>
        <label className="form-field">新密码<input className="form-input" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="输入至少 8 位的新密码" /></label>
        <label className="form-field">确认新密码<input className="form-input" name="confirmation" type="password" autoComplete="new-password" minLength={8} required placeholder="再次输入新密码" /></label>
        <VerificationCodeField id="password-change-code" countdown={passwordCountdown} onSend={sendPasswordCode} />
        <div className="flex justify-end"><button className="quiet-button" type="submit">更新密码</button></div>
      </form>
    </section>
  </div>
}

function VerificationCodeField({ id, countdown, onSend }: { id: string; countdown: number; onSend: () => void }) {
  return <div className="form-field">
    <label htmlFor={id}>邮箱验证码</label>
    <div className="flex items-stretch gap-2">
      <input id={id} className="form-input min-w-0 flex-1 tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="输入 6 位验证码" title="请输入 6 位数字验证码" />
      <button className="quiet-button shrink-0 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={countdown > 0} onClick={onSend}>{countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}</button>
    </div>
  </div>
}
