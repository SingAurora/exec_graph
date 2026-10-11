import { Compass, FolderKanban, Home, LogOut, Moon, Settings, Sun, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppView, UserProfile } from '../../shared/model'
import { GenderMark } from '../../shared/ui/profile/GenderMark'

type AppShellProps = {
  profile: UserProfile
  profileStats: { createdProjects: number; completedRecords: number }
  activeView: AppView
  darkMode: boolean
  onLogout: () => void
  onToggleTheme: () => void
  children: ReactNode
}

const globalNavigation: { view: AppView; label: string; icon: typeof Home }[] = [
  { view: 'my', label: '我的', icon: UserRound },
  { view: 'following', label: '关注', icon: Compass },
  { view: 'home', label: '发现', icon: Home },
  { view: 'settings', label: '设置', icon: Settings },
]

export function AppShell({ profile, profileStats, activeView, darkMode, onLogout, onToggleTheme, children }: AppShellProps) {
  const globalView = activeView === 'publish' || activeView === 'project' || activeView === 'projects' ? 'my' : activeView === 'topic' ? 'home' : activeView
  const pageTitle: Record<AppView, string> = { my: '首页', following: '关注', home: '发现', settings: '设置', project: '项目详情', projects: '所有项目', publish: 'AI 互动', topic: '行动主题' }

  return <div className="app-shell">
    <aside className="sidebar" aria-label="主导航">
        <a className="brand" href="#my" aria-label="ExecG 我的工作台"><span className="brand-mark">E</span><span>ExecG</span></a>
      <nav className="nav-list">
        {globalNavigation.map(({ view, label, icon: Icon }) => <a className={`nav-item ${globalView === view ? 'is-active' : ''}`} href={`#${view}`} key={view}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>{label}
        </a>)}
      </nav>
      <div className="sidebar-bottom">
        <section className="sidebar-profile" aria-label="个人资料">
          <div className="sidebar-user"><Avatar profile={profile} size="medium" /><span className="sidebar-user-text"><strong>{profile.name}<GenderMark gender={profile.gender} /></strong><small>{profile.email}</small></span></div>
          <div className="sidebar-profile-details"><p>{profile.bio}</p><div className="sidebar-profile-stats"><span><strong>{profile.activeDays}</strong><small>活跃天数</small></span><span><strong>{profileStats.createdProjects}</strong><small>创建项目</small></span><span><strong>{profileStats.completedRecords}</strong><small>完成记录</small></span></div></div>
        </section>
        <div className="sidebar-account-actions"><button className="sidebar-action" type="button" onClick={onToggleTheme}><span className="sidebar-action-icon">{darkMode ? <Sun size={15} /> : <Moon size={15} />}</span>{darkMode ? '浅色模式' : '深色模式'}</button><button className="sidebar-action sidebar-logout" type="button" onClick={onLogout}><span className="sidebar-action-icon"><LogOut size={15} /></span>退出登录</button></div>
      </div>
    </aside>

    <main className="main-content" id="top">
      <header className="mobile-header"><a className="brand" href="#my"><span className="brand-mark">E</span><span>ExecG</span></a></header>
      <header className="page-topbar"><h1>{pageTitle[activeView]}</h1>{activeView === 'my' && <a className="topbar-projects-link" href="#projects"><FolderKanban size={16} />所有项目</a>}</header>
      <nav className="mobile-nav" aria-label="主导航">{globalNavigation.slice(0, 3).map(({ view, label }) => <a className={`nav-item ${globalView === view ? 'is-active' : ''}`} href={`#${view}`} key={view}>{label}</a>)}</nav>
      {children}
    </main>
  </div>
}

export function Avatar({ profile, label, size, tone }: { profile?: UserProfile; label?: string; size: 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral' }) {
  const className = `avatar avatar-${size}${tone ? ` avatar-${tone}` : ''}${profile?.avatar ? ' avatar-has-image' : ''}`
  return <span className={className} style={profile?.avatar ? { backgroundImage: `url("${profile.avatar}")` } : undefined}>{profile?.avatar ? '' : label ?? profile?.name.slice(0, 1) ?? 'A'}</span>
}
