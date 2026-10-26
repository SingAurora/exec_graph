import { LockKeyhole, Palette, PanelsTopLeft, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AvatarEditor } from '../../features/profile/ui/AvatarEditor'
import { ProfileBackgroundEditor } from '../../features/profile/ui/ProfileBackgroundEditor'
import { AccountSecurity } from '../../features/account-security/ui/AccountSecurity'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { Select } from '../../shared/ui/select/Select'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { useToast } from '../../shared/ui/toast/useToast'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import type { UserProfile } from '../../entities/profile/model/types'
import { ComponentShowcase } from './components/ComponentShowcase'
import { AppearanceSettings } from './AppearanceSettings'
import type { GraphBackgroundPreferences } from '../../shared/ui/graph-background/model'

type SettingsPanelProps = {
  csrfToken: string
  profile: UserProfile
  darkMode: boolean
  showActionGraphLegend: boolean
  graphBackground: GraphBackgroundPreferences
  onGraphBackgroundChange: (preferences: GraphBackgroundPreferences) => void
  onSave: (profile: UserProfile) => void | Promise<void>
  onToggleTheme: () => void
  onShowActionGraphLegendChange: (show: boolean) => void
}

type SettingsTab = 'profile' | 'account' | 'preferences' | 'components'
const categories = [
  { id: 'profile', label: '个人资料', icon: UserRound },
  { id: 'account', label: '账户安全', icon: LockKeyhole },
  { id: 'preferences', label: '外观', icon: Palette },
  { id: 'components', label: '组件演示', icon: PanelsTopLeft },
] as const

/** Global preferences with consistent forms and retained tab drafts. */
export function SettingsPanel({ profile, csrfToken, darkMode, showActionGraphLegend, graphBackground, onGraphBackgroundChange, onSave, onToggleTheme, onShowActionGraphLegendChange }: SettingsPanelProps) {
  const [draft, setDraft] = useState(profile)
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const { showToast } = useToast()
  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim() || backgroundLoading || saving) return
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim(), bio: draft.bio.trim() })
      showToast({ kind: 'info', message: '个人资料已保存' })
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '保存失败，请重试' }) }
    finally { setSaving(false) }
  }
  return <section aria-label="全局设置">
    <TabsRoot value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
      <TabsList label="设置分类" showDivider={false}>{categories.filter(({ id }) => id !== 'components' || profile.isTestAccount).map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><span className="inline-flex items-center gap-1.5"><Icon size={16} />{label}</span></TabsTrigger>)}</TabsList>
      <TabsContent value="profile" keepMounted>
        <div className="mt-7 grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8">
          <div><h2 className="text-base font-semibold">公开资料</h2><a className="text-button mt-2" href={'#profile?userId=' + encodeURIComponent(profile.id)}>查看我的主页</a></div>
          <form className="grid gap-5" onSubmit={saveProfile}>
            <fieldset className="contents" disabled={saving}>
            <div className="flex items-center gap-4"><AvatarEditor value={draft.avatar} fallback={draft.name.slice(0, 1)} onChange={(avatar) => update('avatar', avatar)} /><span className="text-sm text-muted">个人头像</span></div>
            <ProfileBackgroundEditor value={draft.backgroundImage} onChange={(image) => update('backgroundImage', image)} onLoadingChange={setBackgroundLoading} />
            <label className="form-field">昵称<input className="form-input" required maxLength={30} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="昵称" /></label>
            <div className="form-field"><span>性别</span><Select className="!h-10 w-full !border !border-line !bg-surface !text-sm !font-normal" ariaLabel="性别" value={draft.gender} onValueChange={(value) => update('gender', value as UserProfile['gender'])} options={[{ value: 'male', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="male" />男</span> }, { value: 'female', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="female" />女</span> }, { value: 'unknown', label: '不展示' }]} /></div>
            <div className="form-field">
              <div className="flex items-center gap-1"><label htmlFor="profile-biography">个人简介</label><HelpPopover title="个人简介">
                <p>支持 Markdown 加粗、列表、表情符号和图片链接。不支持普通链接；站内跳转、网页和邮箱链接都只显示文字，不能点击。</p>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-soft p-3 font-mono text-[11px] leading-6">{'🍅 **认真吃饭，随手记录。**\n\n从一盘番茄炒蛋开始。\n\n![图片说明](https://example.com/photo.jpg)'}</pre>
                <p>最多 1000 个字符，包含 Markdown 标记和图片网址。</p>
                <p>主页展示完整简介；左下角卡片显示首段文字和第一张图片。修改后点击「保存资料」生效。</p>
              </HelpPopover></div>
              <textarea id="profile-biography" className="form-input min-h-36 resize-y leading-6" rows={5} maxLength={1000} value={draft.bio} onChange={(event) => update('bio', event.target.value)} placeholder="写一点关于自己的事" />
            </div>
            <div className="flex justify-end"><button className="primary-button" type="submit" disabled={!draft.name.trim() || backgroundLoading}>保存资料</button></div>
            </fieldset>
          </form>
        </div>
      </TabsContent>
      <TabsContent value="account" keepMounted>
        <AccountSecurity email={profile.email} csrfToken={csrfToken} />
      </TabsContent>
      <TabsContent value="preferences" keepMounted>
        <AppearanceSettings darkMode={darkMode} onToggleTheme={onToggleTheme} graphBackground={graphBackground} onGraphBackgroundChange={onGraphBackgroundChange} showActionGraphLegend={showActionGraphLegend} onShowActionGraphLegendChange={onShowActionGraphLegendChange} />
      </TabsContent>
      {profile.isTestAccount && <TabsContent value="components" keepMounted><ComponentShowcase /></TabsContent>}
    </TabsRoot>
  </section>
}
