import type { AppView, UserProfile } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type ProfileHeaderProps = {
  profile: UserProfile
  activeCount: number
  completedCount: number
  activeView: AppView
  onNavigate: (view: AppView) => void
}

const tabs: { view: AppView; label: string }[] = [
  { view: 'home', label: '首页' },
  { view: 'today', label: '今天' },
  { view: 'actions', label: '行动' },
  { view: 'records', label: '记录' },
  { view: 'following', label: '关注' },
]

export function ProfileHeader({ profile, activeCount, completedCount, activeView, onNavigate }: ProfileHeaderProps) {
  return <>
    <section className="profile-header">
      <div className="profile-topline">
        <div className="profile-identity">
          <Avatar profile={profile} size="large" />
          <div><div className="eyebrow">我的页面</div><h1>{profile.name}</h1><p className="profile-email">{profile.email}</p></div>
        </div>
        <button className="quiet-button" type="button" onClick={() => onNavigate('settings')}>编辑资料</button>
      </div>
      <p className="profile-bio">{profile.bio}</p>
      <div className="profile-meta"><span><strong>{activeCount}</strong> 项进行中</span><span><strong>{completedCount}</strong> 条完成记录</span><span>性别：<strong>{{ male: '男', female: '女', unknown: '未知' }[profile.gender]}</strong></span><span>加入于 2026 年</span></div>
    </section>
    <nav className="profile-tabs" aria-label="我的页面内容">
      {tabs.map(({ view, label }) => <a className={`profile-tab ${view === activeView ? 'is-active' : ''}`} href={`#${view}`} key={view}>{label}</a>)}
    </nav>
  </>
}
