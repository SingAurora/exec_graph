import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, CheckCircle2, Eye, EyeOff, FileText, ImagePlus, KeyRound, LoaderCircle, LogOut, Mail, MailCheck, Pencil, Plus, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { AvatarCropDialog } from '@/features/profile/ui/AvatarCropDialog'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { CustomProfileCodeEditor } from '@/entities/account/ui/CustomProfileCodeEditor'
import { CustomProfileContent } from '@/entities/account/ui/CustomProfileContent'
import { updateCurrentUserProfile, uploadCurrentUserAvatar, uploadCurrentUserProfileBackground } from '@/entities/account/api/client'
import { createAIKey, deleteAIKey, listAIKeys, testAIKeyConfiguration, verifySavedAIKey } from '@/entities/ai-key/api/client'
import { changeLoginEmail, changeLoginPassword, sendVerificationCode } from '@/features/auth/api/client'
import { SmartContractsScreen } from '@/features/smart-contract/ui/SmartContractsScreen'
import { aiProviderOptions, controlClass, emailSchema, genderOptions, passwordSchema, profileSchema, settingsSections, type AIKey, type AIProvider, type AccountSection, type ExecutionSection, type EmailForm, type PasswordForm, type ProfileForm, type ProfileSection, type SettingsSection } from '@/features/profile/model/settings'
import { defaultCustomProfileMarkdown } from '@/features/profile/model/defaultProfileTemplate'

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
  const [profileBackgroundUrl, setProfileBackgroundUrl] = useState(actor?.profileBackgroundUrl ?? '')
  const [avatarError, setAvatarError] = useState('')
  const [profileBackgroundError, setProfileBackgroundError] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingProfileBackground, setIsUploadingProfileBackground] = useState(false)
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false)
  const profileBackgroundInputRef = useRef<HTMLInputElement | null>(null)
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
  const [isAIKeyDialogOpen, setIsAIKeyDialogOpen] = useState(false)
  const [isCustomProfilePreviewOpen, setIsCustomProfilePreviewOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile')
  const [profileSection, setProfileSection] = useState<ProfileSection>('basic')
  const [accountSection, setAccountSection] = useState<AccountSection>('email')
  const [executionSection, setExecutionSection] = useState<ExecutionSection>('keys')

  useEffect(() => {
    setAvatarUrl(actor?.avatarUrl ?? '')
  }, [actor?.avatarUrl])

  useEffect(() => {
    setProfileBackgroundUrl(actor?.profileBackgroundUrl ?? '')
  }, [actor?.profileBackgroundUrl])

  const {
    register: registerProfile,
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    getValues: getProfileValues,
    watch: watchProfile,
    setValue: setProfileValue,
    formState: { errors: profileErrors, isSubmitting: isSavingProfile },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: actor?.name ?? '',
      userId: actor?.handle.replace(/^@/, '') ?? '',
      gender: actor?.gender ?? 'undisclosed',
      bio: actor?.bio ?? '',
      customProfileEnabled: actor?.customProfileEnabled ?? false,
      customProfileMarkdown: actor?.customProfileMarkdown ?? defaultCustomProfileMarkdown,
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

  const uploadAvatar = async (file: File) => {
    if (!accessToken) {
      throw new Error('当前身份没有后端会话，请重新注册后再上传头像。')
    }
    setAvatarError('')
    setIsUploadingAvatar(true)
    try {
      const uploadedAvatarUrl = await uploadCurrentUserAvatar(accessToken, file)
      setAvatarUrl(uploadedAvatarUrl)
      updateProfile({ ...getProfileValues(), avatarUrl: uploadedAvatarUrl })
      setAvatarError('')
      setProfileSaved(false)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error('无法连接服务，请确认后端已启动。')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const uploadProfileBackground = async (file: File) => {
    if (!accessToken) {
      setProfileBackgroundError('当前身份没有后端会话，请重新登录后再上传背景图。')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileBackgroundError('背景图片不能超过 2 MB。')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileBackgroundError('背景图片仅支持 PNG、JPEG 或 WebP 格式。')
      return
    }
    setProfileBackgroundError('')
    setIsUploadingProfileBackground(true)
    try {
      const uploadedBackgroundUrl = await uploadCurrentUserProfileBackground(accessToken, file)
      setProfileBackgroundUrl(uploadedBackgroundUrl)
      updateProfile({ ...getProfileValues(), avatarUrl: avatarUrl || undefined, profileBackgroundUrl: uploadedBackgroundUrl })
      setProfileSaved(false)
      showSuccessToast('背景图已更新。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。'
      setProfileBackgroundError(message)
      showErrorToast(message)
    } finally {
      setIsUploadingProfileBackground(false)
    }
  }

  const onProfileBackgroundFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadProfileBackground(file)
  }

  const onProfileSubmit = async (values: ProfileForm) => {
    if (!accessToken) {
      setAvatarError('当前身份没有后端会话，请重新登录后再保存资料。')
      return
    }
    const wasCustomProfileEnabled = Boolean(actor?.customProfileEnabled)
    setAvatarError('')
    setProfileSaved(false)
    try {
      const data = await updateCurrentUserProfile(accessToken, values)
      if (!data.user?.username || !data.user.userId) {
        setAvatarError('保存公开资料失败。')
        return
      }
      updateProfile({
        username: data.user.username,
        userId: data.user.userId,
        bio: data.user.bio ?? '',
        gender: data.user.gender ?? 'undisclosed',
        avatarUrl: (data.user.avatarUrl ?? avatarUrl) || undefined,
        profileBackgroundUrl: (data.user.profileBackgroundUrl ?? profileBackgroundUrl) || undefined,
        customProfileEnabled: data.user.customProfileEnabled ?? values.customProfileEnabled,
        customProfileMarkdown: data.user.customProfileMarkdown ?? values.customProfileMarkdown,
      })
      setAvatarUrl(data.user.avatarUrl ?? avatarUrl)
      setProfileBackgroundUrl(data.user.profileBackgroundUrl ?? profileBackgroundUrl)
      setProfileSaved(true)
      if (!wasCustomProfileEnabled && values.customProfileEnabled) {
        setProfileSection('custom')
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    }
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
      const data = await listAIKeys(accessToken)
      setAIKeys(data.keys ?? [])
    } catch (error) {
      setAIKeyMessage(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    } finally {
      setIsLoadingAIKeys(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadAIKeys()
  }, [loadAIKeys])

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
      const data = await createAIKey(accessToken, getAIKeyDraft())
      setAIKeys((keys) => [...keys, data])
      setAIKeyValue('')
      setAIKeyLabel('')
      setIsAIKeyVisible(false)
      setIsAIKeyDialogOpen(false)
      setAIKeyMessage('AI 密钥已保存。')
      showSuccessToast('AI 密钥已保存。')
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      showErrorToast(message)
    } finally {
      setIsSavingAIKey(false)
    }
  }

  const onAIKeyTest = async () => {
    if (!validateAIKeyDraft('测试')) return
    setIsTestingAIKey(true)
    try {
      const data = await testAIKeyConfiguration(accessToken, getAIKeyDraft())
      const message = data.message ?? '测试通过。'
      setAIKeyMessage(message)
      showSuccessToast(message)
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      showErrorToast(message)
    } finally {
      setIsTestingAIKey(false)
    }
  }

  const updateAIKey = async (key: AIKey, action: 'verify' | 'delete') => {
    if (!accessToken) return
    setAIKeyMessage('')
    setBusyAIKeyID(key.uuid)
    try {
      if (action === 'delete') {
        const data = await deleteAIKey(accessToken, key.uuid)
        setAIKeys((keys) => keys.filter((item) => item.uuid !== key.uuid))
        const message = data.message ?? 'AI 密钥已删除。'
        setAIKeyMessage(message)
      } else {
        const data = await verifySavedAIKey(accessToken, key.uuid)
        setAIKeys((keys) => keys.map((item) => (item.uuid === key.uuid ? { ...item, lastVerifiedAt: data.lastVerifiedAt ?? new Date().toISOString() } : item)))
        const message = data.message ?? '操作已完成。'
        setAIKeyMessage(message)
        showSuccessToast(message)
      }
    } catch {
      const message = '无法连接服务，请确认后端已启动。'
      setAIKeyMessage(message)
      if (action === 'verify') showErrorToast(message)
    } finally {
      setBusyAIKeyID('')
    }
  }

  const requestVerificationCode = async (purpose: 'change_email' | 'change_password', email?: string) => {
    const data = await sendVerificationCode({ purpose, ...(email ? { email } : {}) }, accessToken)
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
      const message = await requestVerificationCode('change_email', getEmailValues('email'))
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
      const message = await requestVerificationCode('change_password')
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
      await changeLoginEmail(accessToken, values)
      const result = updateAccountEmail(values.email)
      setEmailMessage(result.success ? '邮箱已更新' : result.message ?? '邮箱更新失败。')
      if (result.success) resetEmail({ email: values.email.trim().toLowerCase(), currentPassword: '', code: '' })
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    }
  }

  const onPasswordSubmit = async (values: PasswordForm) => {
    setPasswordMessage('')
    if (!accessToken) {
      setPasswordMessage('当前身份没有后端会话，请重新注册后再修改密码。')
      return
    }
    try {
      await changeLoginPassword(accessToken, values)
      const result = updateAccountPassword()
      setPasswordMessage(result.success ? '密码已更新' : result.message ?? '密码更新失败。')
      if (result.success) resetPassword()
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    }
  }

  const onSignOut = () => {
    signOut()
    navigate('/login')
  }

  const hasAvatar = Boolean(avatarUrl)
  const hasProfileBackground = Boolean(profileBackgroundUrl)
  const profileBackgroundStyle = hasProfileBackground
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.26)),url(${JSON.stringify(profileBackgroundUrl)})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }
    : undefined
  const customProfileMarkdown = watchProfile('customProfileMarkdown')
  const savedCustomProfileEnabled = Boolean(actor?.customProfileEnabled)

  const selectedAIProvider = getAIProviderOption(aiKeyProvider)

  return (
    <div className="space-y-8">
      <section className="border-b border-rail pb-6">
        <div className="font-mono text-xs font-semibold uppercase text-signal">Settings</div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">个人设置</h1>
        <nav className="mt-6 flex flex-wrap gap-1" aria-label="设置分类">
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = settingsSection === section.id
            return (
              <button key={section.id} type="button" onClick={() => setSettingsSection(section.id)} className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${isActive ? 'bg-signal/10 text-signal' : 'text-graphite hover:bg-shell/70 hover:text-ink'}`}>
                <Icon size={16} aria-hidden="true" />
                {section.label}
              </button>
            )
          })}
        </nav>
      </section>

      {settingsSection === 'profile' ? (
        <div className="max-w-3xl">
        <form className="rounded-md border border-rail bg-surface/72 p-5" onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <UserRound size={16} aria-hidden="true" />
            Public profile
          </div>

          <nav className="mt-5 flex gap-1 border-b border-rail" aria-label="个人资料配置">
            <button type="button" onClick={() => setProfileSection('basic')} className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${profileSection === 'basic' ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}>
              <UserRound size={15} aria-hidden="true" />
              基本资料
            </button>
            {savedCustomProfileEnabled ? (
              <button type="button" onClick={() => setProfileSection('custom')} className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${profileSection === 'custom' ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}>
                <FileText size={15} aria-hidden="true" />
                自定义主页
              </button>
            ) : null}
          </nav>

          {profileSection === 'basic' ? (
            <>
          <div className="mt-5 border-b border-rail pb-5">
            <input ref={profileBackgroundInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onProfileBackgroundFileChange} />
            <button
              type="button"
              onClick={() => profileBackgroundInputRef.current?.click()}
              disabled={isUploadingProfileBackground}
              style={profileBackgroundStyle}
              className="group relative block h-36 w-full overflow-hidden rounded-md border border-rail bg-[radial-gradient(circle_at_18%_18%,rgba(22,119,255,0.50),transparent_26%),radial-gradient(circle_at_78%_16%,rgba(46,139,87,0.36),transparent_28%),linear-gradient(135deg,rgb(var(--color-inverse)),rgb(var(--color-signal)))] text-left transition focus:outline-none focus-visible:shadow-focusline disabled:cursor-wait disabled:opacity-70"
              aria-label="编辑个人背景图"
              title="编辑个人背景图"
            >
              <span className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-md border border-white/35 bg-black/45 px-3 text-sm font-semibold text-white shadow-sm backdrop-blur transition group-hover:bg-black/58">
                {isUploadingProfileBackground ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                {hasProfileBackground ? '更换背景' : '添加背景'}
              </span>
            </button>
            {profileBackgroundError ? <p className="mt-3 text-sm font-medium text-clay">{profileBackgroundError}</p> : null}
          </div>

          <div className="mt-5 border-b border-rail pb-5">
            <button
              type="button"
              onClick={() => setIsAvatarDialogOpen(true)}
              disabled={isUploadingAvatar}
              className="group relative block size-16 overflow-hidden rounded-full border border-rail text-left transition focus:outline-none focus-visible:shadow-focusline disabled:cursor-wait disabled:opacity-60"
              aria-label="编辑头像"
              title="编辑头像"
            >
              {hasAvatar ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center bg-inverse font-display text-xl font-semibold text-white" aria-hidden="true">
                  {avatarInitials(actor?.handle ?? '')}
                </span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-inverse/70 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Pencil size={18} aria-hidden="true" />
              </span>
            </button>
            {avatarError ? <p className="mt-3 text-sm font-medium text-clay">{avatarError}</p> : null}
          </div>
          <AvatarCropDialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen} onSave={uploadAvatar} isSaving={isUploadingAvatar} />

          <div className="mt-5 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">用户名</span>
              <input autoComplete="username" className={controlClass} {...registerProfile('username')} />
              {profileErrors.username?.message ? <span className="text-sm font-medium text-clay">{profileErrors.username.message}</span> : null}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">用户 ID</span>
              <div className="flex h-11 overflow-hidden rounded-md border border-rail bg-paper focus-within:border-signal focus-within:shadow-focusline">
                <span className="grid w-10 shrink-0 place-items-center border-r border-rail font-mono text-sm text-graphite">@</span>
                <input autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" {...registerProfile('userId')} />
              </div>
              {profileErrors.userId?.message ? <span className="text-sm font-medium text-clay">{profileErrors.userId.message}</span> : null}
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-ink">性别</legend>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-rail bg-paper">
                {genderOptions.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer border-r border-rail last:border-r-0 has-[:checked]:bg-signal/10 has-[:checked]:text-signal"
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

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-rail bg-paper px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">使用自定义个人页</span>
                <span className="mt-1 block text-xs leading-5 text-graphite">保存后公开主页会出现自定义主页标签。</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                {...registerProfile('customProfileEnabled', {
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    const enabled = Boolean(event.target.checked)
                    if (enabled) {
                      if (!getProfileValues('customProfileMarkdown').trim()) {
                        setProfileValue('customProfileMarkdown', defaultCustomProfileMarkdown)
                      }
                    } else {
                      setProfileSection('basic')
                    }
                  },
                })}
              />
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-rail transition peer-checked:bg-signal after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" aria-hidden="true" />
            </label>
          </div>
            </>
          ) : (
            <div className="mt-5 grid gap-5">
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-ink">自定义展示代码</span>
                <Controller
                  control={profileControl}
                  name="customProfileMarkdown"
                  render={({ field }) => (
                    <CustomProfileCodeEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={defaultCustomProfileMarkdown}
                    />
                  )}
                />
                {profileErrors.customProfileMarkdown?.message ? <span className="text-sm font-medium text-clay">{profileErrors.customProfileMarkdown.message}</span> : null}
              </div>
            </div>
          )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {profileSection === 'custom' ? (
                <button
                  type="button"
                  onClick={() => setIsCustomProfilePreviewOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-4 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"
                >
                  <Eye size={17} aria-hidden="true" />
                  预览效果
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
              >
                <Save size={17} aria-hidden="true" />
                保存公开资料
              </button>
              {profileSaved ? <span className="text-sm font-semibold text-moss">已保存</span> : null}
            </div>
        </form>
        <Dialog open={isCustomProfilePreviewOpen} onOpenChange={setIsCustomProfilePreviewOpen}>
          <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-6xl">
            <DialogHeader>
              <DialogTitle>预览自定义主页</DialogTitle>
              <DialogDescription>当前编辑内容的展示效果。</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 py-6">
              {customProfileMarkdown.trim() ? <CustomProfileContent content={customProfileMarkdown} className="h-[min(78dvh,760px)]" autoHeight={false} /> : <p className="text-sm text-graphite">暂无预览内容。</p>}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      ) : null}

      {settingsSection === 'account' ? (
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
      ) : null}

      {settingsSection === 'execution' ? (
        <div className="max-w-5xl space-y-8">
      <nav className="flex items-center gap-1 border-b border-rail" aria-label="执行配置分类">
        <button
          type="button"
          onClick={() => setExecutionSection('keys')}
          className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${executionSection === 'keys' ? 'border-signal text-signal' : 'border-transparent text-graphite hover:text-ink'}`}
        >
          <Bot size={16} aria-hidden="true" />
          AI 密钥
        </button>
        <button
          type="button"
          onClick={() => setExecutionSection('contracts')}
          className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${executionSection === 'contracts' ? 'border-signal text-signal' : 'border-transparent text-graphite hover:text-ink'}`}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          智能合约
        </button>
      </nav>

      {executionSection === 'keys' ? (
      <section className="border-b border-rail pb-8" aria-labelledby="ai-keys-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rail pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
              <Bot size={16} aria-hidden="true" />
              AI credentials
            </div>
            <h2 id="ai-keys-title" className="mt-2 font-display text-2xl font-semibold text-ink">AI 密钥</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsAIKeyDialogOpen(true)}
            disabled={!accessToken}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
          >
            <Plus size={16} aria-hidden="true" />
            添加密钥
          </button>
        </div>

        {!accessToken ? <p className="mt-5 text-sm font-medium text-clay">登录后才能配置用于智能合约审查的 AI 密钥。</p> : null}

        <div className="mt-5">
          {isLoadingAIKeys ? <div className="flex items-center gap-2 text-sm font-medium text-graphite"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />读取密钥库</div> : null}
          {!isLoadingAIKeys && accessToken && aiKeys.length === 0 ? <p className="text-sm font-medium text-graphite">尚未添加 AI 密钥。</p> : null}
          <div className="divide-y divide-rail">
            {aiKeys.map((key) => {
              const isBusy = busyAIKeyID === key.uuid
              return (
                <div key={key.uuid} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{key.label}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-graphite">
                      <span>{getAIProviderOption(key.provider).label}</span>
                      <span>{key.model}</span>
                      <span>{key.keyHint}</span>
                      <span>{formatVerifiedAt(key.lastVerifiedAt)}</span>
                    </div>
                    {revealedAIKeyIDs.includes(key.uuid) ? <code className="mt-2 block break-all rounded-md bg-paper px-2 py-1.5 text-xs text-ink">{key.apiKey ?? '此密钥需要重新保存后才能显示原文。'}</code> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setRevealedAIKeyIDs((ids) => (ids.includes(key.uuid) ? ids.filter((id) => id !== key.uuid) : [...ids, key.uuid]))} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title={revealedAIKeyIDs.includes(key.uuid) ? '隐藏原文' : '显示原文'} aria-label={revealedAIKeyIDs.includes(key.uuid) ? `隐藏 ${key.label} 原文` : `显示 ${key.label} 原文`}>{revealedAIKeyIDs.includes(key.uuid) ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                    <button type="button" onClick={() => void updateAIKey(key, 'verify')} disabled={isBusy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-graphite transition hover:border-signal hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="测试密钥" aria-label={`测试 ${key.label}`}>
                      {isBusy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      测试
                    </button>
                    <button type="button" onClick={() => void updateAIKey(key, 'delete')} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-clay disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="删除密钥" aria-label={`删除 ${key.label}`}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      ) : <SmartContractsScreen compact />}

      <Dialog open={isAIKeyDialogOpen} onOpenChange={setIsAIKeyDialogOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加 AI 密钥</DialogTitle>
            <DialogDescription>配置一把用于项目智能合约审查的 AI 密钥。</DialogDescription>
          </DialogHeader>
          <form className="grid max-h-[calc(100dvh-12rem)] gap-4 overflow-y-auto px-6 py-6 lg:grid-cols-2" onSubmit={onAIKeySubmit}>
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
                className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-graphite transition hover:bg-shell hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
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
          <div className="flex flex-wrap items-center gap-3 border-t border-rail pt-5 lg:col-span-2">
            <button type="button" onClick={onAIKeyTest} disabled={!accessToken || isSavingAIKey || isTestingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-4 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isTestingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              测试
            </button>
            <button type="submit" disabled={!accessToken || isSavingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isSavingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              保存 AI 密钥
            </button>
            {aiKeyMessage ? <span className={`text-sm font-semibold ${aiKeyMessage.includes('失败') || aiKeyMessage.includes('请输入') || aiKeyMessage.includes('登录') || aiKeyMessage.includes('无法') ? 'text-clay' : 'text-moss'}`}>{aiKeyMessage}</span> : null}
          </div>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      ) : null}
    </div>
  )
}
