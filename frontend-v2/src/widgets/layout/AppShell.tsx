import { Compass, Home, LogOut, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppView, UserProfile } from '../../shared/model'

type AppShellProps = {
  profile: UserProfile
  activeView: AppView
  onLogout: () => void
  children: ReactNode
}

const globalNavigation: { view: AppView; label: string; icon: typeof Home }[] = [
  { view: 'home', label: '我的', icon: Home },
  { view: 'people', label: '发现', icon: Compass },
  { view: 'settings', label: '设置', icon: Settings },
]

export function AppShell({ profile, activeView, onLogout, children }: AppShellProps) {
  const globalView = ['home', 'today', 'actions', 'records', 'following'].includes(activeView) ? 'home' : activeView

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <a className="brand" href="#home" aria-label="ExecG 首页"><span className="brand-mark">E</span><span>ExecG</span></a>
        <nav className="nav-list">
          {globalNavigation.map(({ view, label, icon: Icon }) => (
            <a className={`nav-item ${globalView === view ? 'is-active' : ''}`} href={`#${view}`} key={view}>
              <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>{label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <Avatar profile={profile} size="small" />
            <span className="sidebar-user-text"><strong>{profile.name}</strong><small>{profile.email}</small></span>
            <button className="logout-button" type="button" aria-label="退出登录" title="退出登录" onClick={onLogout}>
              <LogOut className="logout-icon" size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="mobile-header"><a className="brand" href="#home"><span className="brand-mark">E</span><span>ExecG</span></a></header>
        <nav className="mobile-nav" aria-label="主导航">
          {globalNavigation.map(({ view, label }) => <a className={`nav-item ${globalView === view ? 'is-active' : ''}`} href={`#${view}`} key={view}>{label}</a>)}
        </nav>
        {children}
      </main>
    </div>
  )
}

export function Avatar({ profile, label, size, tone }: { profile?: UserProfile; label?: string; size: 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral' }) {
  const className = `avatar avatar-${size}${tone ? ` avatar-${tone}` : ''}${profile?.avatar ? ' avatar-has-image' : ''}`
  return <span className={className} style={profile?.avatar ? { backgroundImage: `url("${profile.avatar}")` } : undefined}>{profile?.avatar ? '' : label ?? profile?.name.slice(0, 1) ?? 'A'}</span>
}
