import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { UserProfile } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type SettingsPanelProps = { profile: UserProfile; darkMode: boolean; onSave: (profile: UserProfile) => void; onToggleTheme: () => void }

export function SettingsPanel({ profile, darkMode, onSave, onToggleTheme }: SettingsPanelProps) {
  const [draft, setDraft] = useState(profile)
  const [emailStatus, setEmailStatus] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [avatarStatus, setAvatarStatus] = useState('支持 JPG、PNG 或 WEBP 图片')

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const saveProfile = (event: FormEvent) => { event.preventDefault(); onSave({ ...draft, name: draft.name.trim() || '乔', bio: draft.bio.trim() || '把想法变成正在发生的事情。' }) }
  const readAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.addEventListener('load', () => { update('avatar', String(reader.result)); setAvatarStatus('头像已更新') })
    reader.readAsDataURL(file)
  }

  return <section className="settings-section" aria-labelledby="settings-title"><div className="section-heading"><div><div className="section-kicker">调整你的使用方式</div><h2 id="settings-title">设置</h2></div></div>
    <div className="settings-list"><div className="setting-row profile-setting-row"><div><strong>个人资料</strong><span>昵称、邮箱和个人简介</span></div>
      <form className="profile-settings-form" onSubmit={saveProfile}>
        <div className="avatar-setting"><Avatar profile={draft} size="medium" /><div className="avatar-setting-copy"><label className="quiet-button avatar-upload-button" htmlFor="avatarInput">编辑头像</label><input id="avatarInput" className="sr-only" type="file" accept="image/*" onChange={readAvatar} /><span>{avatarStatus}</span></div></div>
        <label><span className="sr-only">昵称</span><input type="text" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="昵称" /></label>
        <label><span className="sr-only">性别</span><select value={draft.gender} onChange={(event) => update('gender', event.target.value as UserProfile['gender'])}><option value="male">男</option><option value="female">女</option><option value="unknown">未知</option></select></label>
        <label><span className="sr-only">个人简介</span><textarea rows={2} value={draft.bio} onChange={(event) => update('bio', event.target.value)} placeholder="个人简介" /></label>
        <button className="quiet-button" type="submit">保存资料</button>
      </form>
    </div><div className="setting-row readonly-setting-row"><div><strong>当前邮箱</strong><span>用于登录和接收账户通知</span></div><strong className="setting-value">{profile.email}</strong></div></div>
    <div className="settings-subheading">账户安全</div><div className="settings-list security-list">
      <div className="setting-row security-setting-row"><div><strong>修改邮箱</strong><span>修改后需要通过新邮箱验证</span></div><form className="security-form" onSubmit={(event) => { event.preventDefault(); setEmailStatus('验证邮件已发送') }}><label><span className="sr-only">新邮箱</span><input type="email" placeholder="输入新的邮箱" /></label><button className="quiet-button" type="submit">{emailStatus || '发送验证邮件'}</button></form></div>
      <div className="setting-row security-setting-row"><div><strong>更新密码</strong><span>使用至少 8 位的新密码</span></div><form className="security-form" onSubmit={(event) => { event.preventDefault(); setPasswordStatus('密码已更新') }}><label><span className="sr-only">新密码</span><input type="password" minLength={8} placeholder="输入新密码" /></label><label><span className="sr-only">确认新密码</span><input type="password" minLength={8} placeholder="再次输入新密码" /></label><button className="quiet-button" type="submit">{passwordStatus || '更新密码'}</button></form></div>
    </div><div className="settings-list"><div className="setting-row theme-setting-row"><div><strong>界面主题</strong><span>切换浅色或深色显示</span></div><button className="quiet-button" type="button" onClick={onToggleTheme}>{darkMode ? '切换浅色' : '切换深色'}</button></div></div>
  </section>
}
