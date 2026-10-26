import { LockKeyhole, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { SecurityForm } from './SecurityForm'
import type { SecurityFormKind } from '../lib/validation'

const resendDelaySeconds = 60

/** Keeps account changes inline, with a single focused editing flow. */
export function AccountSecurity({ email, csrfToken }: { email: string; csrfToken: string }) {
  const [editing, setEditing] = useState<SecurityFormKind | null>(null)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [passwordCountdown, setPasswordCountdown] = useState(0)
  const countingDown = emailCountdown > 0 || passwordCountdown > 0

  useEffect(() => {
    if (!countingDown) return
    const timer = window.setInterval(() => {
      setEmailCountdown((seconds) => Math.max(0, seconds - 1))
      setPasswordCountdown((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countingDown])

  return (
    <div className="mt-7 grid gap-7">
      <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8" aria-labelledby="change-email-title">
        <div>
          <div className="flex items-center gap-2"><Mail size={17} className="text-muted" aria-hidden="true" /><h2 id="change-email-title" className="text-base font-semibold">绑定邮箱</h2><HelpPopover title="账户安全"><p>修改邮箱需验证新邮箱并输入当前密码；修改密码需验证当前绑定邮箱。修改成功后，所有已登录会话失效，请重新登录。</p></HelpPopover></div>
          <p className="mt-2 break-all text-sm text-muted">{email}</p>
        </div>
        {editing === 'email'
          ? <SecurityForm key="email" kind="email" email={email} csrfToken={csrfToken} countdown={emailCountdown} onRequestCode={() => setEmailCountdown(resendDelaySeconds)} onCancel={() => setEditing(null)} />
          : <div className="flex justify-end"><button className="quiet-button" type="button" aria-expanded={false} onClick={() => setEditing('email')}>修改邮箱</button></div>}
      </section>
      <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8 border-t border-line pt-7" aria-labelledby="change-password-title">
        <div><div className="flex items-center gap-2"><LockKeyhole size={17} className="text-muted" aria-hidden="true" /><h2 id="change-password-title" className="text-base font-semibold">登录密码</h2></div><p className="mt-2 text-sm text-muted">通过绑定邮箱验证身份</p></div>
        {editing === 'password'
          ? <SecurityForm key="password" kind="password" email={email} csrfToken={csrfToken} countdown={passwordCountdown} onRequestCode={() => setPasswordCountdown(resendDelaySeconds)} onCancel={() => setEditing(null)} />
          : <div className="flex justify-end"><button className="quiet-button" type="button" aria-expanded={false} onClick={() => setEditing('password')}>修改密码</button></div>}
      </section>
    </div>
  )
}
