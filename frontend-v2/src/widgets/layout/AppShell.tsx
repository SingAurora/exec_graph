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

  return <div className="mx-auto grid min-h-screen w-[min(1200px,calc(100%-72px))] grid-cols-[224px_minmax(0,880px)] gap-[62px] max-[1000px]:w-[min(920px,calc(100%-48px))] max-[1000px]:grid-cols-[190px_minmax(0,1fr)] max-[1000px]:gap-[38px] max-[700px]:block max-[700px]:w-full">
    <aside className="sticky top-0 flex h-screen flex-col py-[30px] pb-6 max-[700px]:hidden" aria-label="主导航">
        <a className="inline-flex w-max items-center gap-2.5 font-bold tracking-[-.02em] text-ink" href="#my" aria-label="ExecG 我的工作台"><span className="grid size-[30px] place-items-center rounded-[9px] bg-signal font-sans text-[15px] text-white">E</span><span>ExecG</span></a>
      <nav className="mt-[22px] grid gap-[5px]">
        {globalNavigation.map(({ view, label, icon: Icon }) => <a className={`flex w-full items-center gap-[13px] rounded-[7px] px-3 py-[11px] text-[15px] leading-[22px] font-semibold text-muted transition duration-150 hover:bg-soft hover:text-ink ${globalView === view ? 'bg-soft text-signal' : ''}`} href={`#${view}`} key={view}>
          <span className="grid w-[22px] place-items-center"><Icon size={17} strokeWidth={1.8} /></span>{label}
        </a>)}
      </nav>
      <div className="mt-auto grid gap-5">
        <section className="rounded-lg border border-line bg-surface p-3" aria-label="个人资料">
          <div className="flex items-center gap-[9px]"><Avatar profile={profile} size="medium" /><span className="grid min-w-0 gap-0.5"><strong className="inline-flex min-w-0 items-center gap-1.5 text-sm">{profile.name}<GenderMark gender={profile.gender} /></strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted">{profile.email}</small></span></div>
          <div className="mt-3 grid gap-[11px] border-t border-line pt-[11px]"><p className="line-clamp-2 overflow-hidden text-[13px] leading-[1.5] text-muted">{profile.bio}</p><div className="grid grid-cols-3 gap-1.5">{[[profile.activeDays, '活跃天数'], [profileStats.createdProjects, '创建项目'], [profileStats.completedRecords, '完成记录']].map(([value, label]) => <span className="grid min-w-0 gap-0.5" key={label}><strong className="font-sans text-[17px] leading-none text-ink">{value}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted">{label}</small></span>)}</div></div>
        </section>
        <div className="grid grid-cols-2 gap-[7px]"><button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={onToggleTheme}><span className="inline-flex">{darkMode ? <Sun size={15} /> : <Moon size={15} />}</span>{darkMode ? '浅色模式' : '深色模式'}</button><button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral" type="button" onClick={onLogout}><span className="inline-flex"><LogOut size={15} /></span>退出登录</button></div>
      </div>
    </aside>

    <main className="min-w-0 py-[30px] pb-[100px] max-[700px]:px-[18px] max-[700px]:pb-[70px] max-[700px]:pt-0" id="top">
      <header className="hidden h-[62px] items-center justify-between border-b border-line max-[700px]:flex"><a className="inline-flex w-max items-center gap-2.5 font-bold tracking-[-.02em] text-ink" href="#my"><span className="grid size-[30px] place-items-center rounded-[9px] bg-signal font-sans text-[15px] text-white">E</span><span>ExecG</span></a></header>
      <header className="flex min-h-[66px] items-center justify-between gap-5 border-b border-line max-[700px]:min-h-[58px]"><h1 className="font-sans text-[21px] tracking-[-.03em] max-[700px]:text-[19px]">{pageTitle[activeView]}</h1>{activeView === 'my' && <a className="inline-flex min-h-[34px] items-center gap-[7px] rounded-md border border-line bg-surface px-2.5 py-[7px] text-xs font-bold text-ink transition hover:border-signal hover:text-signal" href="#projects"><FolderKanban size={16} />所有项目</a>}</header>
      <nav className="hidden grid-cols-3 gap-1 max-[700px]:mt-3 max-[700px]:grid" aria-label="主导航">{globalNavigation.slice(0, 3).map(({ view, label }) => <a className={`flex items-center justify-center rounded-[7px] px-1 py-[9px] text-[13px] leading-5 font-semibold text-muted hover:bg-soft hover:text-ink ${globalView === view ? 'bg-soft text-signal' : ''}`} href={`#${view}`} key={view}>{label}</a>)}</nav>
      {children}
    </main>
  </div>
}

export function Avatar({ profile, label, size, tone }: { profile?: UserProfile; label?: string; size: 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral' }) {
  const sizeClass = { small: 'size-8 text-xs', medium: 'size-10 text-sm', large: 'size-[68px] text-2xl' }[size]
  const toneClass = tone === 'coral' ? 'bg-[#f1dfdc] text-coral' : tone === 'blue' ? 'bg-[#dfeaf0] text-[#4d7894]' : 'bg-[#dce9e3] text-signal-dark'
  const className = `inline-grid min-w-0 flex-none place-items-center overflow-hidden rounded-[11px] font-bold ${sizeClass} ${toneClass} ${profile?.avatar ? 'bg-cover bg-center bg-no-repeat text-transparent' : ''}`
  return <span className={className} style={profile?.avatar ? { backgroundImage: `url("${profile.avatar}")` } : undefined}>{profile?.avatar ? '' : label ?? profile?.name.slice(0, 1) ?? 'A'}</span>
}
