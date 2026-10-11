import type { AppView, UserProfile } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type ProfileHeaderProps = {
  profile: UserProfile
  activeCount: number
  completedCount: number
  activeView: AppView
}

export function ProfileHeader({ profile, activeCount, completedCount, activeView }: ProfileHeaderProps) {
  return <section className="profile-header"><div className="profile-topline"><div className="profile-identity"><Avatar profile={profile} size="large" /><div><div className="eyebrow">个人页面</div><h2>{profile.name}</h2><p className="profile-email">{profile.email}</p></div></div><a className="quiet-button" href="#settings">编辑资料</a></div><p className="profile-bio">{profile.bio}</p><div className="profile-meta"><span><strong>{activeCount}</strong> 项进行中</span><span><strong>{completedCount}</strong> 条完成记录</span><span>加入于 2026 年</span></div><nav className="profile-tabs" aria-label="个人内容"><a className={`profile-tab ${activeView === 'my' ? 'is-active' : ''}`} href="#my">进行中</a><a className={`profile-tab ${activeView === 'home' ? 'is-active' : ''}`} href="#my?tab=completed">已完成</a></nav></section>
}
