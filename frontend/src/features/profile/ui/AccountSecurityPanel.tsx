import { KeyRound, LogOut, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { FieldErrors, UseFormHandleSubmit, UseFormRegister } from 'react-hook-form'
import { controlClass, type AccountSection, type EmailForm, type PasswordForm } from '@/features/profile/model/settings'

type AccountSecurityPanelProps = {
  accountSection: AccountSection
  setAccountSection: (section: AccountSection) => void
  accountEmail: string
  accessToken: string
  registerEmail: UseFormRegister<EmailForm>
  handleEmailSubmit: UseFormHandleSubmit<EmailForm>
  emailErrors: FieldErrors<EmailForm>
  isSavingEmail: boolean
  onEmailSubmit: (values: EmailForm) => Promise<void>
  onSendEmailCode: () => Promise<void>
  emailCodeCountdown: number
  isSendingEmailCode: boolean
  registerPassword: UseFormRegister<PasswordForm>
  handlePasswordSubmit: UseFormHandleSubmit<PasswordForm>
  passwordErrors: FieldErrors<PasswordForm>
  isSavingPassword: boolean
  onPasswordSubmit: (values: PasswordForm) => Promise<void>
  onSendPasswordCode: () => Promise<void>
  passwordCodeCountdown: number
  isSendingPasswordCode: boolean
  emailMessage: string
  passwordMessage: string
  onSignOut: () => void
}

export function AccountSecurityPanel(props: AccountSecurityPanelProps) {
  const {
    accountSection, setAccountSection, accountEmail, registerEmail, handleEmailSubmit, emailErrors, isSavingEmail,
    onEmailSubmit, onSendEmailCode, emailCodeCountdown, isSendingEmailCode, registerPassword, handlePasswordSubmit,
    passwordErrors, isSavingPassword, onPasswordSubmit, onSendPasswordCode, passwordCodeCountdown, isSendingPasswordCode,
    emailMessage, passwordMessage, onSignOut,
  } = props

  return (
        <div className="max-w-3xl">
        <section className="rounded-md border border-rail bg-surface/72 p-5" aria-labelledby="account-settings-title">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <ShieldCheck size={16} aria-hidden="true" />
            Account security
          </div>
          <h2 id="account-settings-title" className="mt-2 font-display text-2xl font-semibold text-ink">
            账户安全
          </h2>

          <nav className="mt-5 flex gap-1 border-b border-rail" aria-label="账户安全配置">
            <button
              type="button"
              onClick={() => setAccountSection('email')}
              className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${accountSection === 'email' ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}
            >
              <Mail size={15} aria-hidden="true" />
              修改邮箱
            </button>
            <button
              type="button"
              onClick={() => setAccountSection('password')}
              className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${accountSection === 'password' ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}
            >
              <KeyRound size={15} aria-hidden="true" />
              修改密码
            </button>
          </nav>

          {accountSection === 'email' ? (
          <form className="mt-5 grid gap-4" onSubmit={handleEmailSubmit(onEmailSubmit)}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Mail size={16} className="text-signal" aria-hidden="true" />
              修改邮箱
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">新邮箱</span>
              <div className="flex gap-2">
                <input type="email" autoComplete="email" className={`${controlClass} min-w-0 flex-1`} {...registerEmail('email')} />
                <button
                  type="button"
                  onClick={onSendEmailCode}
                  disabled={isSendingEmailCode || emailCodeCountdown > 0}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
                >
                  <MailCheck size={16} aria-hidden="true" />
                  {isSendingEmailCode ? '发送中' : emailCodeCountdown > 0 ? `${emailCodeCountdown}s 后重发` : '发送验证码'}
                </button>
              </div>
              {emailErrors.email?.message ? <span className="text-sm font-medium text-clay">{emailErrors.email.message}</span> : null}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">邮箱验证码</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="输入 6 位验证码"
                className={`${controlClass} tracking-[0.2em]`}
                {...registerEmail('code')}
              />
              {emailErrors.code?.message ? <span className="text-sm font-medium text-clay">{emailErrors.code.message}</span> : null}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">当前密码</span>
              <input type="password" autoComplete="current-password" className={controlClass} {...registerEmail('currentPassword')} />
              {emailErrors.currentPassword?.message ? <span className="text-sm font-medium text-clay">{emailErrors.currentPassword.message}</span> : null}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingEmail}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                <Mail size={16} aria-hidden="true" />
                更新邮箱
              </button>
              {emailMessage ? <span className={`text-sm font-semibold ${emailMessage === '邮箱已更新' ? 'text-moss' : 'text-clay'}`}>{emailMessage}</span> : null}
            </div>
          </form>
          ) : (

          <form className="mt-5 grid gap-4" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <KeyRound size={16} className="text-signal" aria-hidden="true" />
              修改密码
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">当前密码</span>
                <input type="password" autoComplete="current-password" className={controlClass} {...registerPassword('currentPassword')} />
                {passwordErrors.currentPassword?.message ? <span className="text-sm font-medium text-clay">{passwordErrors.currentPassword.message}</span> : null}
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">新密码</span>
                <input type="password" autoComplete="new-password" className={controlClass} {...registerPassword('nextPassword')} />
                {passwordErrors.nextPassword?.message ? <span className="text-sm font-medium text-clay">{passwordErrors.nextPassword.message}</span> : null}
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">确认新密码</span>
              <input type="password" autoComplete="new-password" className={controlClass} {...registerPassword('confirmation')} />
              {passwordErrors.confirmation?.message ? <span className="text-sm font-medium text-clay">{passwordErrors.confirmation.message}</span> : null}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">邮箱验证码</span>
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="输入 6 位验证码"
                  className={`${controlClass} min-w-0 flex-1 tracking-[0.2em]`}
                  {...registerPassword('code')}
                />
                <button
                  type="button"
                  onClick={onSendPasswordCode}
                  disabled={isSendingPasswordCode || passwordCodeCountdown > 0}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
                >
                  <MailCheck size={16} aria-hidden="true" />
                  {isSendingPasswordCode ? '发送中' : passwordCodeCountdown > 0 ? `${passwordCodeCountdown}s 后重发` : '发送验证码'}
                </button>
              </div>
              {passwordErrors.code?.message ? <span className="text-sm font-medium text-clay">{passwordErrors.code.message}</span> : null}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                <KeyRound size={16} aria-hidden="true" />
                更新密码
              </button>
              {passwordMessage ? <span className={`text-sm font-semibold ${passwordMessage === '密码已更新' ? 'text-moss' : 'text-clay'}`}>{passwordMessage}</span> : null}
            </div>
          </form>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-rail pt-5">
            <span className="text-sm font-medium text-graphite">{accountEmail}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-graphite transition hover:bg-paper hover:text-ink focus:outline-none focus-visible:shadow-focusline"
            >
              <LogOut size={16} aria-hidden="true" />
              退出登录
            </button>
          </div>
        </section>
        </div>
  )
}
