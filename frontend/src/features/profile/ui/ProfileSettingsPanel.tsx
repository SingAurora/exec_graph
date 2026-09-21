import { ChangeEvent, CSSProperties, RefObject } from 'react'
import { Controller, Control, FieldErrors, UseFormGetValues, UseFormHandleSubmit, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { Eye, FileText, ImagePlus, LoaderCircle, Pencil, Save, UserRound } from 'lucide-react'
import { AvatarCropDialog } from '@/features/profile/ui/AvatarCropDialog'
import { CustomProfileCodeEditor } from '@/entities/account/ui/CustomProfileCodeEditor'
import { CustomProfileContent } from '@/entities/account/ui/CustomProfileContent'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import type { Actor } from '@/entities/account/model/types'
import { controlClass, genderOptions, type ProfileForm, type ProfileSection } from '@/features/profile/model/settings'
import { defaultCustomProfileMarkdown } from '@/features/profile/model/defaultProfileTemplate'

function avatarInitials(handle: string) {
  return handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

type ProfileSettingsPanelProps = {
  actor?: Actor
  avatarUrl: string
  profileBackgroundUrl: string
  avatarError: string
  profileBackgroundError: string
  isUploadingAvatar: boolean
  isUploadingProfileBackground: boolean
  isAvatarDialogOpen: boolean
  setIsAvatarDialogOpen: (open: boolean) => void
  profileBackgroundInputRef: RefObject<HTMLInputElement | null>
  profileSaved: boolean
  profileSection: ProfileSection
  setProfileSection: (section: ProfileSection) => void
  profileBackgroundStyle?: CSSProperties
  customProfileMarkdown: string
  isCustomProfilePreviewOpen: boolean
  setIsCustomProfilePreviewOpen: (open: boolean) => void
  registerProfile: UseFormRegister<ProfileForm>
  profileControl: Control<ProfileForm>
  handleProfileSubmit: UseFormHandleSubmit<ProfileForm>
  getProfileValues: UseFormGetValues<ProfileForm>
  setProfileValue: UseFormSetValue<ProfileForm>
  profileErrors: FieldErrors<ProfileForm>
  isSavingProfile: boolean
  onProfileSubmit: (values: ProfileForm) => Promise<void>
  onProfileBackgroundFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  uploadAvatar: (file: File) => Promise<void>
}

export function ProfileSettingsPanel(props: ProfileSettingsPanelProps) {
  const {
    actor, avatarUrl, profileBackgroundUrl, avatarError, profileBackgroundError, isUploadingAvatar, isUploadingProfileBackground,
    isAvatarDialogOpen, setIsAvatarDialogOpen, profileBackgroundInputRef, profileSaved, profileSection, setProfileSection,
    profileBackgroundStyle, customProfileMarkdown, isCustomProfilePreviewOpen, setIsCustomProfilePreviewOpen,
    registerProfile, profileControl, handleProfileSubmit, getProfileValues, setProfileValue, profileErrors, isSavingProfile,
    onProfileSubmit, onProfileBackgroundFileChange, uploadAvatar,
  } = props
  const hasAvatar = Boolean(avatarUrl)
  const hasProfileBackground = Boolean(profileBackgroundUrl)
  const savedCustomProfileEnabled = Boolean(actor?.customProfileEnabled)

  return (
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
  )
}
