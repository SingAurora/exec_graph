import { KeyRound, LockKeyhole, Palette, PanelsTopLeft, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Switch } from 'radix-ui'
import { AvatarEditor } from '../../features/profile/ui/AvatarEditor'
import { AccountSecurity } from '../../features/account-security/ui/AccountSecurity'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { Select } from '../../shared/ui/select/Select'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { useToast } from '../../shared/ui/toast/useToast'
import type { AIKeyConfig, SaveAIKeyInput } from '../../entities/ai-key/model/types'
import { AIKeySettings } from '../../features/ai-key/ui/AIKeySettings'
import type { UserProfile } from '../../shared/model'
import { ComponentShowcase } from './components/ComponentShowcase'
import { GraphBackgroundSettings } from '../../features/graph-appearance/ui/GraphBackgroundSettings'
import type { GraphBackgroundPreferences } from '../../shared/ui/graph-background/model'

type SettingsPanelProps = {
  profile: UserProfile
  darkMode: boolean
  showActionGraphLegend: boolean
  graphBackground: GraphBackgroundPreferences
  onGraphBackgroundChange: (preferences: GraphBackgroundPreferences) => void
  aiConfigs: AIKeyConfig[]
  onSave: (profile: UserProfile) => void
  onToggleTheme: () => void
  onShowActionGraphLegendChange: (show: boolean) => void
  onSaveAIConfig: (input: SaveAIKeyInput) => void
  onSetDefaultAIConfig: (id: string) => void
  onDeleteAIConfig: (id: string) => void
}

type SettingsTab = 'profile' | 'ai' | 'account' | 'preferences' | 'components'
const categories = [
  { id: 'profile', label: '个人资料', icon: UserRound },
  { id: 'ai', label: 'AI 服务', icon: KeyRound },
  { id: 'account', label: '账户安全', icon: LockKeyhole },
  { id: 'preferences', label: '外观', icon: Palette },
  { id: 'components', label: '组件演示', icon: PanelsTopLeft },
] as const

/** Global preferences with consistent forms and retained tab drafts. */
export function SettingsPanel({ profile, darkMode, showActionGraphLegend, graphBackground, onGraphBackgroundChange, aiConfigs, onSave, onToggleTheme, onShowActionGraphLegendChange, onSaveAIConfig, onSetDefaultAIConfig, onDeleteAIConfig }: SettingsPanelProps) {
  const [draft, setDraft] = useState(profile)
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const { showToast } = useToast()
  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSave({ ...draft, name: draft.name.trim(), bio: draft.bio.trim() })
    showToast({ kind: 'info', message: '个人资料已保存' })
  }
  return <section aria-label="全局设置">
    <TabsRoot value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
      <TabsList label="设置分类" showDivider={false}>{categories.filter(({ id }) => id !== 'components' || profile.isTestAccount).map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><span className="inline-flex items-center gap-1.5"><Icon size={16} />{label}</span></TabsTrigger>)}</TabsList>
      <TabsContent value="profile" keepMounted>
        <div className="mt-7 grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8">
          <div><h2 className="text-base font-semibold">公开资料</h2><a className="text-button mt-2" href={'#profile?userId=' + encodeURIComponent(profile.id)}>查看我的主页</a></div>
          <form className="grid gap-5" onSubmit={saveProfile}>
            <div className="flex items-center gap-4"><AvatarEditor value={draft.avatar} fallback={draft.name.slice(0, 1)} onChange={(avatar) => update('avatar', avatar)} /><span className="text-sm text-muted">个人头像</span></div>
            <label className="form-field">昵称<input className="form-input" required maxLength={30} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="昵称" /></label>
            <div className="form-field"><span>性别</span><Select className="!h-10 w-full !border !border-line !bg-surface !text-sm !font-normal" ariaLabel="性别" value={draft.gender} onValueChange={(value) => update('gender', value as UserProfile['gender'])} options={[{ value: 'male', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="male" />男</span> }, { value: 'female', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="female" />女</span> }, { value: 'unknown', label: '不展示' }]} /></div>
            <label className="form-field">个人简介<textarea className="form-input min-h-28 resize-y leading-6" rows={3} maxLength={200} value={draft.bio} onChange={(event) => update('bio', event.target.value)} placeholder="写一点关于自己的事" /></label>
            <div className="flex justify-end"><button className="primary-button" type="submit" disabled={!draft.name.trim()}>保存资料</button></div>
          </form>
        </div>
      </TabsContent>
      <TabsContent value="ai" keepMounted><AIKeySettings configs={aiConfigs} onSave={onSaveAIConfig} onSetDefault={onSetDefaultAIConfig} onDelete={onDeleteAIConfig} /></TabsContent>
      <TabsContent value="account" keepMounted>
        <AccountSecurity email={profile.email} />
      </TabsContent>
      <TabsContent value="preferences" keepMounted>
        <div className="mt-5 grid gap-5"><div className="flex items-center justify-between gap-5 max-[700px]:grid max-[700px]:items-start"><div className="grid gap-[5px]"><strong className="text-sm">界面主题</strong><span className="text-xs text-muted">切换浅色或深色显示</span></div><button className="inline-flex w-max items-center justify-center rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={onToggleTheme}>{darkMode ? '切换浅色' : '切换深色'}</button></div>
          <section className="grid grid-cols-[minmax(150px,1fr)_minmax(0,430px)] items-start gap-5 border-t border-line pt-5 max-[700px]:grid-cols-1" aria-labelledby="graph-appearance-title">
            <h3 id="graph-appearance-title" className="text-sm font-semibold">行动节点图</h3>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-5"><label className="cursor-pointer text-[13px]" htmlFor="show-action-graph-legend">显示图例</label><Switch.Root id="show-action-graph-legend" checked={showActionGraphLegend} onCheckedChange={onShowActionGraphLegendChange} className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 bg-line p-0.5 outline-none transition-colors data-[state=checked]:bg-signal focus-visible:ring-2 focus-visible:ring-signal/25"><Switch.Thumb className="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" /></Switch.Root></div>
              <GraphBackgroundSettings preferences={graphBackground} onChange={onGraphBackgroundChange} />
            </div>
          </section>
        </div>

      </TabsContent>
      {profile.isTestAccount && <TabsContent value="components" keepMounted><ComponentShowcase /></TabsContent>}
    </TabsRoot>
  </section>
}
