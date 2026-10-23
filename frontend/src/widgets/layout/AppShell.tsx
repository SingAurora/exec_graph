import { Bookmark, Compass, Home, LogOut, Moon, Settings2, Sun, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppView } from '../../shared/lib/navigation'
import type { UserProfile } from '../../entities/profile/model/types'
import { BackButton } from '../../shared/ui/navigation/BackButton'
import { Brand } from '../../shared/ui/Brand'
import { SidebarProfileCard, type SidebarProfileStats } from './SidebarProfileCard'
import { AppBackdrop } from './AppBackdrop'

type AppShellProps = {
  profile: UserProfile
  profileStats: SidebarProfileStats
  activeView: AppView
  darkMode: boolean
  onLogout: () => void
  onToggleTheme: () => void
  backAction?: { label: string; onBack: () => void }
  projectTitle?: string
  publishTitle?: string
  children: ReactNode
}

const globalNavigation: { view: AppView; label: string; icon: typeof Home }[] = [
  { view: 'my', label: '我的', icon: UserRound },
  { view: 'home', label: '发现', icon: Compass },
  { view: 'following', label: '关注', icon: Bookmark },
  { view: 'settings', label: '设置', icon: Settings2 },
]

/** 应用外壳：左侧导航和本人资料、顶部标题与返回入口；children 是当前业务页面。 */
export function AppShell({ profile, profileStats, activeView, darkMode, onLogout, onToggleTheme, backAction, projectTitle, publishTitle, children }: AppShellProps) {
  const globalView = activeView === 'graph-search' ? 'home' : ['projects', 'publish', 'project', 'action-archive'].includes(activeView) ? 'my' : activeView
  const pageTitle: Record<AppView, string> = { my: '我的', following: '关注', home: '发现', settings: '设置', project: projectTitle ?? '行动图', projects: '行动图', publish: publishTitle ?? '记录行动', topic: '发现', 'action-archive': '形成过程', profile: '主页', 'graph-search': '搜索图' }

  return <div className="relative isolate mx-auto grid min-h-screen w-[min(1200px,calc(100%-72px))] grid-cols-[224px_minmax(0,880px)] gap-[62px] max-[1000px]:w-[min(920px,calc(100%-48px))] max-[1000px]:grid-cols-[190px_minmax(0,1fr)] max-[1000px]:gap-[38px]">
    <AppBackdrop />
    <aside className="sticky top-0 flex h-screen flex-col py-[30px] pb-6" aria-label="主导航">
      <a className="inline-flex w-max rounded-sm" href="#my" aria-label="引序 我的"><Brand /></a>
      <nav className="mt-7 grid gap-1.5">
        {globalNavigation.map(({ view, label, icon: Icon }) => <a className={'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition hover:bg-soft hover:text-ink ' + (globalView === view ? 'bg-soft font-semibold text-signal' : 'text-muted')} href={'#' + view} aria-current={globalView === view ? 'page' : undefined} key={view}><Icon size={19} strokeWidth={1.8} />{label}</a>)}
      </nav>
      <div className="mt-auto grid gap-5">
        <SidebarProfileCard profile={profile} stats={profileStats} />
        <div className="grid grid-cols-2 gap-[7px]"><button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={onToggleTheme}><span className="inline-flex">{darkMode ? <Sun size={15} /> : <Moon size={15} />}</span>{darkMode ? '浅色模式' : '深色模式'}</button><button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral" type="button" onClick={onLogout}><span className="inline-flex"><LogOut size={15} /></span>退出登录</button></div>
      </div>
    </aside>
    <main className={'relative min-w-0 pt-[30px] ' + (activeView === 'project' ? 'pb-0' : 'pb-20')} id="top">
      {activeView === 'project' ? backAction && <div className="absolute -left-[38px] top-[30px] z-10"><BackButton label={backAction.label} onBack={backAction.onBack} /></div> : <header className="flex min-h-[66px] items-center border-b border-line"><div className="relative min-w-0">{backAction && <div className="absolute right-full top-1/2 mr-2.5 flex -translate-y-1/2"><BackButton label={backAction.label} onBack={backAction.onBack} /></div>}<h1 className="text-[22px] font-semibold tracking-tight">{pageTitle[activeView]}</h1></div></header>}
      {children}
    </main>
  </div>
}
