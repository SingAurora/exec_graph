import { zodResolver } from '@hookform/resolvers/zod'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import { updateCurrentUserProfile, uploadCurrentUserAvatar, uploadCurrentUserProfileBackground } from '@/entities/account/api/client'
import { changeLoginEmail, changeLoginPassword, sendVerificationCode } from '@/features/auth/api/client'
import { emailSchema, passwordSchema, profileSchema, settingsSections, type AccountSection, type ExecutionSection, type EmailForm, type PasswordForm, type ProfileForm, type ProfileSection, type SettingsSection } from '@/features/profile/model/settings'
import { defaultCustomProfileMarkdown } from '@/features/profile/model/defaultProfileTemplate'
import { ProfileSettingsPanel } from './ProfileSettingsPanel'
import { AccountSecurityPanel } from './AccountSecurityPanel'
import { ExecutionSettingsPanel } from './ExecutionSettingsPanel'
import { useAIKeySettings } from '@/features/profile/model/useAIKeySettings'

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
  const [isCustomProfilePreviewOpen, setIsCustomProfilePreviewOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile')
  const [profileSection, setProfileSection] = useState<ProfileSection>('basic')
  const [accountSection, setAccountSection] = useState<AccountSection>('email')
  const [executionSection, setExecutionSection] = useState<ExecutionSection>('keys')

  const {
    aiKeys, aiKeyProvider, aiKeyLabel, aiKeyValue, aiKeyBaseURL, aiKeyModel, aiKeyMessage, isAIKeyVisible,
    isTestingAIKey, isLoadingAIKeys, isSavingAIKey, busyAIKeyID, revealedAIKeyIDs, isAIKeyDialogOpen,
    setIsAIKeyDialogOpen, setIsAIKeyVisible, setRevealedAIKeyIDs, onAIProviderChange, onAIKeySubmit,
    onAIKeyTest, updateAIKey, setAIKeyLabel, setAIKeyValue, setAIKeyBaseURL, setAIKeyModel,
  } = useAIKeySettings(accessToken)

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

  const profileBackgroundStyle = profileBackgroundUrl
    ? {
        backgroundImage: 'linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.26)),url(' + JSON.stringify(profileBackgroundUrl) + ')',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }
    : undefined
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
        <ProfileSettingsPanel actor={actor} avatarUrl={avatarUrl} profileBackgroundUrl={profileBackgroundUrl} avatarError={avatarError} profileBackgroundError={profileBackgroundError} isUploadingAvatar={isUploadingAvatar} isUploadingProfileBackground={isUploadingProfileBackground} isAvatarDialogOpen={isAvatarDialogOpen} setIsAvatarDialogOpen={setIsAvatarDialogOpen} profileBackgroundInputRef={profileBackgroundInputRef} profileSaved={profileSaved} profileSection={profileSection} setProfileSection={setProfileSection} profileBackgroundStyle={profileBackgroundStyle} customProfileMarkdown={watchProfile('customProfileMarkdown')} isCustomProfilePreviewOpen={isCustomProfilePreviewOpen} setIsCustomProfilePreviewOpen={setIsCustomProfilePreviewOpen} registerProfile={registerProfile} profileControl={profileControl} handleProfileSubmit={handleProfileSubmit} getProfileValues={getProfileValues} setProfileValue={setProfileValue} profileErrors={profileErrors} isSavingProfile={isSavingProfile} onProfileSubmit={onProfileSubmit} onProfileBackgroundFileChange={onProfileBackgroundFileChange} uploadAvatar={uploadAvatar} />
      ) : null}
      {settingsSection === 'account' ? (
        <AccountSecurityPanel accountSection={accountSection} setAccountSection={setAccountSection} accountEmail={accountEmail} accessToken={accessToken} registerEmail={registerEmail} handleEmailSubmit={handleEmailSubmit} emailErrors={emailErrors} isSavingEmail={isSavingEmail} onEmailSubmit={onEmailSubmit} onSendEmailCode={onSendEmailCode} emailCodeCountdown={emailCodeCountdown} isSendingEmailCode={isSendingEmailCode} registerPassword={registerPassword} handlePasswordSubmit={handlePasswordSubmit} passwordErrors={passwordErrors} isSavingPassword={isSavingPassword} onPasswordSubmit={onPasswordSubmit} onSendPasswordCode={onSendPasswordCode} passwordCodeCountdown={passwordCodeCountdown} isSendingPasswordCode={isSendingPasswordCode} emailMessage={emailMessage} passwordMessage={passwordMessage} onSignOut={onSignOut} />
      ) : null}
      {settingsSection === 'execution' ? (
        <ExecutionSettingsPanel executionSection={executionSection} setExecutionSection={setExecutionSection} accessToken={accessToken} aiKeys={aiKeys} isLoadingAIKeys={isLoadingAIKeys} isAIKeyDialogOpen={isAIKeyDialogOpen} setIsAIKeyDialogOpen={setIsAIKeyDialogOpen} aiKeyProvider={aiKeyProvider} aiKeyLabel={aiKeyLabel} aiKeyValue={aiKeyValue} aiKeyBaseURL={aiKeyBaseURL} aiKeyModel={aiKeyModel} aiKeyMessage={aiKeyMessage} isAIKeyVisible={isAIKeyVisible} setIsAIKeyVisible={setIsAIKeyVisible} isTestingAIKey={isTestingAIKey} isSavingAIKey={isSavingAIKey} busyAIKeyID={busyAIKeyID} revealedAIKeyIDs={revealedAIKeyIDs} setRevealedAIKeyIDs={setRevealedAIKeyIDs} onAIProviderChange={onAIProviderChange} onAIKeySubmit={onAIKeySubmit} onAIKeyTest={onAIKeyTest} updateAIKey={updateAIKey} setAIKeyLabel={setAIKeyLabel} setAIKeyValue={setAIKeyValue} setAIKeyBaseURL={setAIKeyBaseURL} setAIKeyModel={setAIKeyModel} />
      ) : null}
    </div>
  )
}
