import { useState, type FormEvent } from 'react'
import { Switch } from 'radix-ui'
import { AvatarEditor } from '../../features/profile/ui/AvatarEditor'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { Select } from '../../shared/ui/select/Select'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
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
const defaultBio = '把想法变成正在发生的事情。'

export function SettingsPanel({ profile, darkMode, showActionGraphLegend, graphBackground, onGraphBackgroundChange, aiConfigs, onSave, onToggleTheme, onShowActionGraphLegendChange, onSaveAIConfig, onSetDefaultAIConfig, onDeleteAIConfig }: SettingsPanelProps) {
  const [draft, setDraft] = useState({ ...profile, bio: profile.bio.trim() || defaultBio })
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [emailStatus, setEmailStatus] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const saveProfile = (event: FormEvent) => { event.preventDefault(); onSave({ ...draft, name: draft.name.trim() || '乔', bio: draft.bio.trim() || defaultBio }) }
  return <section className="pt-[38px]" aria-labelledby="settings-title">
    <div><div className="font-sans text-[11px] font-bold uppercase tracking-[.11em] text-signal">调整你的使用方式</div><h2 id="settings-title" className="mt-[7px] text-[25px] tracking-[-.03em] max-[700px]:text-[22px]">设置</h2></div>
    <TabsRoot value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
      <TabsList label="设置分类">
        <TabsTrigger value="profile">个人资料</TabsTrigger>
        <TabsTrigger value="ai">AI 服务</TabsTrigger>
        <TabsTrigger value="account">账户安全</TabsTrigger>
        <TabsTrigger value="preferences">外观</TabsTrigger>
        {profile.isTestAccount && <TabsTrigger value="components">组件演示</TabsTrigger>}
      </TabsList>

      <TabsContent value="profile">
        <div className="mt-5 grid gap-5"><div className="grid items-start gap-5 min-[701px]:grid-cols-[minmax(150px,1fr)_minmax(0,430px)]"><div className="grid gap-[5px]"><strong className="text-sm">个人资料</strong><span className="text-[13px] text-muted">昵称和个人简介</span></div>
          <form className="grid w-full gap-[9px]" onSubmit={saveProfile}>
            <div className="flex items-start gap-3"><AvatarEditor value={draft.avatar} fallback={draft.name.slice(0, 1)} onChange={(avatar) => update('avatar', avatar)} /><div className="grid gap-[5px]"><span className="text-[11px] text-muted">支持 JPG、PNG 或 WEBP 图片，可在裁剪时调整</span></div></div>
            <label><span className="sr-only">昵称</span><input className="h-9 w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" type="text" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="昵称" /></label>
            <label><span className="sr-only">性别</span><Select className="w-full !border !border-line !bg-transparent focus-visible:!border-signal" ariaLabel="性别" value={draft.gender} onValueChange={(value) => update('gender', value as UserProfile['gender'])} options={[{ value: 'male', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="male" />男</span> }, { value: 'female', label: <span className="inline-flex items-center gap-1.5"><GenderMark gender="female" />女</span> }, { value: 'unknown', label: '未知' }]} /></label>
            <label><span className="sr-only">个人简介</span><textarea className="min-h-[58px] w-full resize-y rounded-md border border-line bg-transparent px-2.5 py-[9px] text-xs text-ink outline-none focus:border-signal" rows={2} value={draft.bio} onChange={(event) => update('bio', event.target.value)} placeholder="个人简介" /></label>
            <button className="inline-flex w-max items-center justify-center rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="submit">保存资料</button>
          </form>
        </div></div>
      </TabsContent>

      <TabsContent value="ai">
        <AIKeySettings configs={aiConfigs} onSave={onSaveAIConfig} onSetDefault={onSetDefaultAIConfig} onDelete={onDeleteAIConfig} />
      </TabsContent>

      <TabsContent value="account">
        <div className="mt-5 grid gap-5">
          <div className="grid items-start gap-5 min-[701px]:grid-cols-[minmax(150px,1fr)_minmax(0,430px)]"><div className="grid gap-[5px]"><strong className="text-sm">修改邮箱</strong><span className="text-xs text-muted">修改后需要通过新邮箱验证</span></div><form className="grid w-full gap-[9px]" onSubmit={(event) => { event.preventDefault(); setEmailStatus('验证邮件已发送') }}><label><span className="sr-only">新邮箱</span><input className="h-9 w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" type="email" placeholder="输入新的邮箱" /></label><button className="inline-flex w-max items-center justify-center rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="submit">{emailStatus || '发送验证邮件'}</button></form></div>
          <div className="grid items-start gap-5 min-[701px]:grid-cols-[minmax(150px,1fr)_minmax(0,430px)]"><div className="grid gap-[5px]"><strong className="text-sm">更新密码</strong><span className="text-xs text-muted">使用至少 8 位的新密码</span></div><form className="grid w-full gap-[9px]" onSubmit={(event) => { event.preventDefault(); setPasswordStatus('密码已更新') }}><label><span className="sr-only">新密码</span><input className="h-9 w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" type="password" minLength={8} placeholder="输入新密码" /></label><label><span className="sr-only">确认新密码</span><input className="h-9 w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" type="password" minLength={8} placeholder="再次输入新密码" /></label><button className="inline-flex w-max items-center justify-center rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="submit">{passwordStatus || '更新密码'}</button></form></div>
        </div>
      </TabsContent>

      <TabsContent value="preferences">
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

      {profile.isTestAccount && <TabsContent value="components"><ComponentShowcase /></TabsContent>}
    </TabsRoot>
  </section>
}
