import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Bot, Camera, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LogOut, Mail, MailCheck, Save, Settings2, ShieldCheck, Star, Trash2, UserRound } from 'lucide-react'
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useExecStore } from '../store/useExecStore'
import { SmartContractsPage } from './SmartContractsPage'
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
  code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码。'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码。'),
    nextPassword: z.string().min(6, '新密码至少需要 6 个字符。'),
    confirmation: z.string().min(1, '请再次输入新密码。'),
    code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码。'),
  })
  .refine((values) => values.nextPassword === values.confirmation, {
    message: '两次输入的新密码不一致。',
    path: ['confirmation'],
  })

type ProfileForm = z.infer<typeof profileSchema>
type EmailForm = z.infer<typeof emailSchema>
type PasswordForm = z.infer<typeof passwordSchema>
type SettingsSection = 'profile' | 'account' | 'ai' | 'contracts'
type AIProvider = 'deepseek' | 'openai' | 'doubao' | 'claude'

type AIKey = {
  id: string
  provider: AIProvider | 'openai_compatible'
  label: string
  apiKey?: string
  keyHint: string
  baseUrl: string
  model: string
  isDefault: boolean
  lastVerifiedAt?: string
}

type ToastState = {
  tone: 'success' | 'error'
  message: string
}

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'undisclosed', label: '不透露' },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
]

const settingsSections: Array<{ id: SettingsSection; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: '个人资料', icon: UserRound },
  { id: 'account', label: '账户安全', icon: ShieldCheck },
  { id: 'ai', label: 'AI 密钥', icon: Bot },
  { id: 'contracts', label: '智能合约', icon: Settings2 },
]

const aiProviderOptions: Array<{ id: AIProvider; label: string; baseUrl: string; modelPlaceholder: string; labelPlaceholder: string }> = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    labelPlaceholder: '例如：个人 DeepSeek',
    modelPlaceholder: '例如：deepseek-chat',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    labelPlaceholder: '例如：个人 OpenAI',
    modelPlaceholder: '例如：gpt-4o-mini',
  },
  {
    id: 'doubao',
    label: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    labelPlaceholder: '例如：个人豆包',
    modelPlaceholder: '例如：doubao-seed-1-6-250615',
  },
  {
    id: 'claude',
    label: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    labelPlaceholder: '例如：个人 Claude',
    modelPlaceholder: '例如：claude-sonnet-4-5-20250929',
  },
]

const controlClass = 'h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline'

function avatarInitials(handle: string) {
  return handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

function formatVerifiedAt(value?: string) {
  if (!value) return '尚未验证'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '已验证' : `已验证 ${date.toLocaleDateString('zh-CN')}`
}

function getAIProviderOption(provider: AIKey['provider']) {
  if (provider === 'openai_compatible') {
    return aiProviderOptions.find((option) => option.id === 'openai') ?? aiProviderOptions[0]
  }
  return aiProviderOptions.find((option) => option.id === provider) ?? aiProviderOptions[0]
}

function Toast({ toast }: { toast: ToastState }) {
  const Icon = toast.tone === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-md border border-rail bg-white px-4 py-3 shadow-lg" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Icon size={18} className={toast.tone === 'success' ? 'text-moss' : 'text-clay'} aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{toast.message}</span>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const currentActorId = useExecStore((state) => state.currentActorId)
  const actor = useExecStore((state) => state.actors.find((item) => item.id === currentActorId))
  const accessToken = useExecStore((state) => state.accessToken)
  const accountEmail = useExecStore((state) => state.accountEmail)
  const updateProfile = useExecStore((state) => state.updateProfile)
  const updateAccountEmail = useExecStore((state) => state.updateAccountEmail)
  const updateAccountPassword = useExecStore((state) => state.updateAccountPassword)
  const signOut = useExecStore((state) => state.signOut)
  const [avatarUrl, setAvatarUrl] = useState(actor?.avatarUrl ?? '')
  const [avatarError, setAvatarError] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0)
  const [passwordCodeCountdown, setPasswordCodeCountdown] = useState(0)
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false)
  const [isSendingPasswordCode, setIsSendingPasswordCode] = useState(false)
  const [aiKeys, setAIKeys] = useState<AIKey[]>([])
  const [aiKeyProvider, setAIKeyProvider] = useState<AIProvider>('deepseek')
  const [aiKeyLabel, setAIKeyLabel] = useState('')
  const [aiKeyValue, setAIKeyValue] = useState('')
  const [aiKeyBaseURL, setAIKeyBaseURL] = useState(getAIProviderOption('deepseek').baseUrl)
  const [aiKeyModel, setAIKeyModel] = useState('')
  const [aiKeyMessage, setAIKeyMessage] = useState('')
  const [isAIKeyVisible, setIsAIKeyVisible] = useState(false)
  const [isTestingAIKey, setIsTestingAIKey] = useState(false)
  const [isLoadingAIKeys, setIsLoadingAIKeys] = useState(false)
  const [isSavingAIKey, setIsSavingAIKey] = useState(false)
  const [busyAIKeyID, setBusyAIKeyID] = useState('')
  const [revealedAIKeyIDs, setRevealedAIKeyIDs] = useState<string[]>([])
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | null>(null)
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    getValues: getProfileValues,
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
    getValues: getEmailValues,
    trigger: triggerEmail,
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

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('头像文件不能超过 2 MB。')
      event.target.value = ''
      return
    }
    if (!accessToken) {
      setAvatarError('当前身份没有后端会话，请重新注册后再上传头像。')
      event.target.value = ''
      return
    }

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      const data = (await response.json().catch(() => ({}))) as { avatarUrl?: string; error?: string }
      if (!response.ok || !data.avatarUrl) {
        setAvatarError(data.error ?? '头像上传失败，请稍后重试。')
        return
      }
      setAvatarUrl(data.avatarUrl)
      updateProfile({ ...getProfileValues(), avatarUrl: data.avatarUrl })
      setAvatarError('')
      setProfileSaved(false)
    } catch {
      setAvatarError('无法连接服务，请确认后端已启动。')
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const onAvatarRemove = async () => {
    if (!accessToken) {
      setAvatarError('当前身份没有后端会话，请重新注册后再移除头像。')
      return
    }
    setIsUploadingAvatar(true)
    try {
      const response = await fetch('/api/users/me/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setAvatarError(data.error ?? '移除头像失败，请稍后重试。')
        return
      }
      setAvatarUrl('')
      updateProfile({ ...getProfileValues(), avatarUrl: undefined })
      setAvatarError('')
      setProfileSaved(false)
    } catch {
      setAvatarError('无法连接服务，请确认后端已启动。')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const onProfileSubmit = (values: ProfileForm) => {
    updateProfile({ ...values, avatarUrl: avatarUrl || undefined })
    setProfileSaved(true)
  }

  useEffect(() => {
    if (emailCodeCountdown === 0 && passwordCodeCountdown === 0) return
    const timer = window.setInterval(() => {
      setEmailCodeCountdown((value) => Math.max(0, value - 1))
      setPasswordCodeCountdown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [emailCodeCountdown, passwordCodeCountdown])

  const loadAIKeys = useCallback(async () => {
    if (!accessToken) {
      setAIKeys([])
      return
    }
    setIsLoadingAIKeys(true)
    try {
      const response = await fetch('/api/ai-keys', { headers: { Authorization: `Bearer ${accessToken}` } })
      const data = (await response.json().catch(() => ({}))) as { keys?: AIKey[]; error?: string }
      if (!response.ok) {
        setAIKeyMessage(data.error ?? '读取 AI 密钥失败。')
        return
      }
      setAIKeys(data.keys ?? [])
    } catch {
      setAIKeyMessage('无法连接服务，请确认后端已启动。')
    } finally {
      setIsLoadingAIKeys(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadAIKeys()
  }, [loadAIKeys])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const onAIProviderChange = (provider: AIProvider) => {
    const option = getAIProviderOption(provider)
    setAIKeyProvider(provider)
    setAIKeyMessage('')
    setAIKeyBaseURL(option.baseUrl)
    setAIKeyModel('')
  }

  const getAIKeyDraft = () => ({
    provider: aiKeyProvider,
    label: aiKeyLabel,
    apiKey: aiKeyValue,
    baseUrl: aiKeyBaseURL,
    model: aiKeyModel,
  })

  const validateAIKeyDraft = (action: '保存' | '测试') => {
    setAIKeyMessage('')
    if (!accessToken) {
      setAIKeyMessage(`登录后才能${action} AI 密钥。`)
      return false
    }
    if (!aiKeyValue.trim()) {
      setAIKeyMessage('请输入 API Key。')
      return false
    }
    if (!aiKeyModel.trim()) {
      setAIKeyMessage('请输入模型名称。')
      return false
    }
    return true
  }

  const onAIKeySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateAIKeyDraft('保存')) return
    setIsSavingAIKey(true)
    try {
      const response = await fetch('/api/ai-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(getAIKeyDraft()),
      })
      const data = (await response.json().catch(() => ({}))) as AIKey & { error?: string }
      if (!response.ok) {
        const message = data.error ?? `保存 AI 密钥失败（HTTP ${response.status}）。`
        setAIKeyMessage(message)
        showToast({ tone: 'error', message })
        return
      }
      setAIKeys((keys) => [...keys, data].sort((left, right) => Number(right.isDefault) - Number(left.isDefault)))
      setAIKeyValue('')
      setAIKeyLabel('')
      setIsAIKeyVisible(false)
      setAIKeyMessage('AI 密钥已保存。')
      showToast({ tone: 'success', message: 'AI 密钥已保存。' })
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      showToast({ tone: 'error', message })
    } finally {
      setIsSavingAIKey(false)
    }
  }

  const onAIKeyTest = async () => {
    if (!validateAIKeyDraft('测试')) return
    setIsTestingAIKey(true)
    try {
      const response = await fetch('/api/ai-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(getAIKeyDraft()),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!response.ok) {
        const message = data.error ?? `测试失败（HTTP ${response.status}），请检查 API Key、服务地址和模型名称。`
        setAIKeyMessage(message)
        showToast({ tone: 'error', message })
        return
      }
      const message = data.message ?? '测试通过。'
      setAIKeyMessage(message)
      showToast({ tone: 'success', message })
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      showToast({ tone: 'error', message })
    } finally {
      setIsTestingAIKey(false)
    }
  }

  const updateAIKey = async (key: AIKey, action: 'default' | 'verify' | 'delete') => {
    if (!accessToken) return
    setAIKeyMessage('')
    setBusyAIKeyID(key.id)
    try {
      const response = await fetch(`/api/ai-keys/${key.id}${action === 'delete' ? '' : `/${action}`}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; lastVerifiedAt?: string }
      if (!response.ok) {
        const message = data.error ?? `AI 密钥操作失败（HTTP ${response.status}）。`
        setAIKeyMessage(message)
        if (action === 'verify') showToast({ tone: 'error', message })
        return
      }
      if (action === 'delete') {
        setAIKeys((keys) => {
          const remaining = keys.filter((item) => item.id !== key.id)
          return remaining.map((item, index) => ({ ...item, isDefault: item.isDefault || (key.isDefault && index === 0) }))
        })
      } else if (action === 'default') {
        setAIKeys((keys) => keys.map((item) => ({ ...item, isDefault: item.id === key.id })))
      } else {
        setAIKeys((keys) => keys.map((item) => (item.id === key.id ? { ...item, lastVerifiedAt: data.lastVerifiedAt ?? new Date().toISOString() } : item)))
      }
      const message = data.message ?? (action === 'delete' ? 'AI 密钥已删除。' : '操作已完成。')
      setAIKeyMessage(message)
      if (action === 'verify') showToast({ tone: 'success', message })
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      if (action === 'verify') showToast({ tone: 'error', message })
    } finally {
      setBusyAIKeyID('')
    }
  }

  const sendVerificationCode = async (purpose: 'change_email' | 'change_password', email?: string) => {
    const response = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ purpose, ...(email ? { email } : {}) }),
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
    if (!response.ok) throw new Error(data.error ?? '验证码发送失败，请稍后重试。')
    return data.message ?? '验证码已发送，请查收邮件。'
  }

  const onSendEmailCode = async () => {
    setEmailMessage('')
    if (!(await triggerEmail('email'))) return
    if (!accessToken) {
      setEmailMessage('当前身份没有后端会话，请重新注册后再修改邮箱。')
      return
    }
    setIsSendingEmailCode(true)
    try {
      const message = await sendVerificationCode('change_email', getEmailValues('email'))
      setEmailCodeCountdown(60)
      setEmailMessage(message)
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。')
    } finally {
      setIsSendingEmailCode(false)
    }
  }

  const onSendPasswordCode = async () => {
    setPasswordMessage('')
    if (!accessToken) {
      setPasswordMessage('当前身份没有后端会话，请重新注册后再修改密码。')
      return
    }
    setIsSendingPasswordCode(true)
    try {
      const message = await sendVerificationCode('change_password')
      setPasswordCodeCountdown(60)
      setPasswordMessage(message)
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。')
    } finally {
      setIsSendingPasswordCode(false)
    }
  }

  const onEmailSubmit = async (values: EmailForm) => {
    setEmailMessage('')
    if (!accessToken) {
      setEmailMessage('当前身份没有后端会话，请重新注册后再修改邮箱。')
      return
    }
    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setEmailMessage(data.error ?? '邮箱更新失败。')
        return
      }
      const result = updateAccountEmail(values.email, values.currentPassword)
      setEmailMessage(result.success ? '邮箱已更新' : result.message ?? '邮箱更新失败。')
      if (result.success) resetEmail({ email: values.email.trim().toLowerCase(), currentPassword: '', code: '' })
    } catch {
      setEmailMessage('无法连接服务，请确认后端已启动。')
    }
  }

  const onPasswordSubmit = async (values: PasswordForm) => {
    setPasswordMessage('')
    if (!accessToken) {
      setPasswordMessage('当前身份没有后端会话，请重新注册后再修改密码。')
      return
    }
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setPasswordMessage(data.error ?? '密码更新失败。')
        return
      }
      const result = updateAccountPassword(values.currentPassword, values.nextPassword)
      setPasswordMessage(result.success ? '密码已更新' : result.message ?? '密码更新失败。')
      if (result.success) resetPassword()
    } catch {
      setPasswordMessage('无法连接服务，请确认后端已启动。')
    }
  }

  const onSignOut = () => {
    signOut()
    navigate('/login')
  }

  const hasAvatar = Boolean(avatarUrl)

  const selectedAIProvider = getAIProviderOption(aiKeyProvider)

  const showToast = (nextToast: ToastState) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(nextToast)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 3200)
  }

  return (
    <div className="space-y-8">
      {toast ? <Toast toast={toast} /> : null}
      <section className="border-b border-rail pb-6">
        <div className="font-mono text-xs font-semibold uppercase text-signal">Settings</div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">个人设置</h1>
        <nav className="mt-6 flex flex-wrap gap-1" aria-label="设置分类">
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = settingsSection === section.id
            return (
              <button key={section.id} type="button" onClick={() => setSettingsSection(section.id)} className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${isActive ? 'bg-ink text-paper' : 'text-graphite hover:bg-white/70 hover:text-ink'}`}>
                <Icon size={16} aria-hidden="true" />
                {section.label}
              </button>
            )
          })}
        </nav>
      </section>

      {settingsSection === 'profile' ? (
        <div className="max-w-2xl">
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
                <label className={`inline-flex h-9 items-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition focus-within:shadow-focusline ${isUploadingAvatar ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-graphite/50'}`}>
                  <Camera size={15} aria-hidden="true" />
                  {isUploadingAvatar ? '上传中' : '选择头像'}
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={isUploadingAvatar} onChange={onAvatarChange} />
                </label>
                {hasAvatar ? (
                  <button
                    type="button"
                    onClick={onAvatarRemove}
                    disabled={isUploadingAvatar}
                    className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-clay disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
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
        </div>
      ) : null}

      {settingsSection === 'account' ? (
        <div className="max-w-3xl">
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
      ) : null}

      {settingsSection === 'ai' ? (
        <div className="max-w-4xl">
      <section className="rounded-md border border-rail bg-white/72 p-5" aria-labelledby="ai-keys-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rail pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
              <Bot size={16} aria-hidden="true" />
              AI credentials
            </div>
            <h2 id="ai-keys-title" className="mt-2 font-display text-2xl font-semibold text-ink">AI 密钥</h2>
          </div>
          <div className="inline-flex h-8 items-center gap-2 rounded-md border border-rail bg-paper px-3 text-xs font-semibold text-graphite">
            <KeyRound size={14} aria-hidden="true" />
            {aiKeys.find((key) => key.isDefault) ? '默认密钥已设置' : '尚未设置默认密钥'}
          </div>
        </div>

        {!accessToken ? <p className="mt-5 text-sm font-medium text-clay">登录后才能配置用于智能合约审查的 AI 密钥。</p> : null}

        <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={onAIKeySubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">服务</span>
            <select value={aiKeyProvider} onChange={(event) => onAIProviderChange(event.target.value as AIProvider)} className={controlClass} disabled={!accessToken || isSavingAIKey}>
              {aiProviderOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">名称</span>
            <input value={aiKeyLabel} onChange={(event) => setAIKeyLabel(event.target.value)} placeholder={selectedAIProvider.labelPlaceholder} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">模型</span>
            <input value={aiKeyModel} onChange={(event) => setAIKeyModel(event.target.value)} placeholder={selectedAIProvider.modelPlaceholder} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">API Key</span>
            <div className="relative">
              <input
                type={isAIKeyVisible ? 'text' : 'password'}
                autoComplete="off"
                value={aiKeyValue}
                onChange={(event) => setAIKeyValue(event.target.value)}
                placeholder="开发期以明文保存"
                className={`${controlClass} w-full pr-11 font-mono`}
                disabled={!accessToken || isSavingAIKey}
              />
              <button
                type="button"
                onClick={() => setIsAIKeyVisible((visible) => !visible)}
                disabled={!accessToken || isSavingAIKey}
                className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
                title={isAIKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                aria-label={isAIKeyVisible ? '隐藏 API Key' : '显示 API Key'}
              >
                {isAIKeyVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </label>
          <label className="grid gap-2 lg:col-span-2">
            <span className="text-sm font-semibold text-ink">服务地址</span>
            <input type="url" value={aiKeyBaseURL} onChange={(event) => setAIKeyBaseURL(event.target.value)} placeholder={selectedAIProvider.baseUrl} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <button type="button" onClick={onAIKeyTest} disabled={!accessToken || isSavingAIKey || isTestingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-4 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isTestingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              测试
            </button>
            <button type="submit" disabled={!accessToken || isSavingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isSavingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              保存 AI 密钥
            </button>
            {aiKeyMessage ? <span className={`text-sm font-semibold ${aiKeyMessage.includes('失败') || aiKeyMessage.includes('请输入') || aiKeyMessage.includes('登录') || aiKeyMessage.includes('无法') ? 'text-clay' : 'text-moss'}`}>{aiKeyMessage}</span> : null}
          </div>
        </form>

        <div className="mt-7 border-t border-rail pt-5">
          {isLoadingAIKeys ? <div className="flex items-center gap-2 text-sm font-medium text-graphite"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />读取密钥库</div> : null}
          {!isLoadingAIKeys && accessToken && aiKeys.length === 0 ? <p className="text-sm font-medium text-graphite">添加一把密钥后，智能合约审查才能发起。</p> : null}
          <div className="divide-y divide-rail">
            {aiKeys.map((key) => {
              const isBusy = busyAIKeyID === key.id
              return (
                <div key={key.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{key.label}</span>
                      {key.isDefault ? <span className="inline-flex items-center gap-1 rounded-md bg-moss/10 px-2 py-1 text-xs font-semibold text-moss"><Star size={12} aria-hidden="true" />默认审查</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-graphite">
                      <span>{getAIProviderOption(key.provider).label}</span>
                      <span>{key.model}</span>
                      <span>{key.keyHint}</span>
                      <span>{formatVerifiedAt(key.lastVerifiedAt)}</span>
                    </div>
                    {revealedAIKeyIDs.includes(key.id) ? <code className="mt-2 block break-all rounded-md bg-paper px-2 py-1.5 text-xs text-ink">{key.apiKey ?? '此密钥需要重新保存后才能显示原文。'}</code> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setRevealedAIKeyIDs((ids) => (ids.includes(key.id) ? ids.filter((id) => id !== key.id) : [...ids, key.id]))} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title={revealedAIKeyIDs.includes(key.id) ? '隐藏原文' : '显示原文'} aria-label={revealedAIKeyIDs.includes(key.id) ? `隐藏 ${key.label} 原文` : `显示 ${key.label} 原文`}>{revealedAIKeyIDs.includes(key.id) ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                    <button type="button" onClick={() => void updateAIKey(key, 'verify')} disabled={isBusy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-graphite transition hover:border-signal hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="测试密钥" aria-label={`测试 ${key.label}`}>
                      {isBusy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      测试
                    </button>
                    {!key.isDefault ? <button type="button" onClick={() => void updateAIKey(key, 'default')} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="设为默认审查密钥" aria-label={`将 ${key.label} 设为默认审查密钥`}><Star size={16} aria-hidden="true" /></button> : null}
                    <button type="button" onClick={() => void updateAIKey(key, 'delete')} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-clay disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="删除密钥" aria-label={`删除 ${key.label}`}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
        </div>
      ) : null}

      {settingsSection === 'contracts' ? <SmartContractsPage compact /> : null}
    </div>
  )
}
