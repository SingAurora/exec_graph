import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, KeyRound, LogOut, Mail, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { ChangeEvent, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useExecStore } from '../store/useExecStore'
import type { Gender } from '../types'

const profileSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(2, '请输入至少两个字符的用户名。')
    .max(24, '用户名最多 24 个字符。')
    .regex(/^@?[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含中英文、数字和下划线。'),
  gender: z.enum(['female', 'male', 'undisclosed']),
  bio: z.string().max(120, '个人说明最多 120 个字符。'),
})

const emailSchema = z.object({
  email: z.string().email('请输入有效邮箱。'),
  currentPassword: z.string().min(1, '请输入当前密码。'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码。'),
    nextPassword: z.string().min(6, '新密码至少需要 6 个字符。'),
    confirmation: z.string().min(1, '请再次输入新密码。'),
  })
  .refine((values) => values.nextPassword === values.confirmation, {
    message: '两次输入的新密码不一致。',
    path: ['confirmation'],
  })

type ProfileForm = z.infer<typeof profileSchema>
type EmailForm = z.infer<typeof emailSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'undisclosed', label: '不透露' },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
]

const controlClass = 'h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline'

function avatarInitials(handle: string) {
  return handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

export function SettingsPage() {
  const navigate = useNavigate()
  const currentActorId = useExecStore((state) => state.currentActorId)
  const actor = useExecStore((state) => state.actors.find((item) => item.id === currentActorId))
  const accountEmail = useExecStore((state) => state.accountEmail)
  const updateProfile = useExecStore((state) => state.updateProfile)
  const updateAccountEmail = useExecStore((state) => state.updateAccountEmail)
  const updateAccountPassword = useExecStore((state) => state.updateAccountPassword)
  const signOut = useExecStore((state) => state.signOut)
  const [avatarUrl, setAvatarUrl] = useState(actor?.avatarUrl ?? '')
  const [avatarError, setAvatarError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isSavingProfile },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      handle: actor?.handle ?? '',
      gender: actor?.gender ?? 'undisclosed',
      bio: actor?.bio ?? '',
    },
  })
  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    formState: { errors: emailErrors, isSubmitting: isSavingEmail },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: accountEmail, currentPassword: '' },
  })
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isSavingPassword },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 750 * 1024) {
      setAvatarError('头像文件不能超过 750 KB。')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
      setAvatarError('')
      setProfileSaved(false)
    }
    reader.readAsDataURL(file)
  }

  const onProfileSubmit = (values: ProfileForm) => {
    updateProfile({ ...values, avatarUrl: avatarUrl || undefined })
    setProfileSaved(true)
  }

  const onEmailSubmit = (values: EmailForm) => {
    const result = updateAccountEmail(values.email, values.currentPassword)
    setEmailMessage(result.success ? '邮箱已更新' : result.message ?? '邮箱更新失败。')
    if (result.success) resetEmail({ email: values.email.trim().toLowerCase(), currentPassword: '' })
  }

  const onPasswordSubmit = (values: PasswordForm) => {
    const result = updateAccountPassword(values.currentPassword, values.nextPassword)
    setPasswordMessage(result.success ? '密码已更新' : result.message ?? '密码更新失败。')
    if (result.success) resetPassword()
  }

  const onSignOut = () => {
    signOut()
    navigate('/login')
  }

  const hasAvatar = Boolean(avatarUrl)

  return (
    <div className="space-y-8">
      <section className="border-b border-rail pb-6">
        <div className="font-mono text-xs font-semibold uppercase text-signal">Settings</div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">个人设置</h1>
      </section>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
        <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <UserRound size={16} aria-hidden="true" />
            Public profile
          </div>

          <div className="mt-5 flex items-center gap-4 border-b border-rail pb-5">
            {hasAvatar ? (
              <img src={avatarUrl} alt="头像预览" className="size-16 rounded-full border border-rail object-cover" />
            ) : (
              <div className="grid size-16 place-items-center rounded-full bg-ink font-display text-xl font-semibold text-paper" aria-label="默认头像">
                {avatarInitials(actor?.handle ?? '')}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus-within:shadow-focusline">
                  <Camera size={15} aria-hidden="true" />
                  选择头像
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} />
                </label>
                {hasAvatar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('')
                      setProfileSaved(false)
                    }}
                    className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-clay focus:outline-none focus-visible:shadow-focusline"
                    aria-label="移除头像"
                    title="移除头像"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {avatarError ? <p className="mt-2 text-sm font-medium text-clay">{avatarError}</p> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">用户名</span>
              <input autoComplete="username" className={controlClass} {...registerProfile('handle')} />
              {profileErrors.handle?.message ? <span className="text-sm font-medium text-clay">{profileErrors.handle.message}</span> : null}
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-ink">性别</legend>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-rail bg-paper">
                {genderOptions.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer border-r border-rail last:border-r-0 has-[:checked]:bg-ink has-[:checked]:text-paper"
                  >
                    <input className="sr-only" type="radio" value={option.value} {...registerProfile('gender')} />
                    <span className="grid h-10 place-items-center text-sm font-semibold">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">个人说明</span>
              <textarea className="min-h-28 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline" {...registerProfile('bio')} />
              {profileErrors.bio?.message ? <span className="text-sm font-medium text-clay">{profileErrors.bio.message}</span> : null}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
              >
                <Save size={17} aria-hidden="true" />
                保存公开资料
              </button>
              {profileSaved ? <span className="text-sm font-semibold text-moss">已保存</span> : null}
            </div>
          </div>
        </form>

        <section className="rounded-md border border-rail bg-white/72 p-5" aria-labelledby="account-settings-title">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <ShieldCheck size={16} aria-hidden="true" />
            Account security
          </div>
          <h2 id="account-settings-title" className="mt-2 font-display text-2xl font-semibold text-ink">
            账户安全
          </h2>

          <form className="mt-5 grid gap-4 border-t border-rail pt-5" onSubmit={handleEmailSubmit(onEmailSubmit)}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Mail size={16} className="text-signal" aria-hidden="true" />
              修改邮箱
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">新邮箱</span>
              <input type="email" autoComplete="email" className={controlClass} {...registerEmail('email')} />
              {emailErrors.email?.message ? <span className="text-sm font-medium text-clay">{emailErrors.email.message}</span> : null}
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

          <form className="mt-7 grid gap-4 border-t border-rail pt-5" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
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
    </div>
  )
}
