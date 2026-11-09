import { Bookmark, Compass, Home, LogOut, Moon, Settings2, Sun, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppView } from '../../shared/lib/navigation'
import type { UserProfile } from '../../entities/profile/model/types'
import { BackButton } from '../../shared/ui/navigation/BackButton'
import { Brand } from '../../shared/ui/Brand'
import { SidebarProfileCard, type SidebarProfileStats } from './SidebarProfileCard'
import { AppBackdrop } from './AppBackdrop'

type AppShellProps = {
  /** 当前用户；加载态允许为空。 */
  profile?: UserProfile
  /** 侧栏展示的行动、表达、约定统计。 */
  profileStats?: SidebarProfileStats
  /** 当前页面，用于导航高亮和标题。 */
  activeView: AppView
  darkMode: boolean
  loading?: boolean
  onLogout?: () => void
  onToggleTheme: () => void
  /** 页面级返回入口；图详情和普通页面放置位置不同。 */
  backAction?: { label: string; onBack: () => void }
  /** 图详情页使用图名称作为标题。 */
  graphTitle?: string
  /** 当前业务页面；由 App 按路由决定具体内容。 */
  children: ReactNode
}

/** 左侧全局导航；子页面通过 globalView 映射回所属父级。 */
const globalNavigation: { view: AppView; label: string; icon: typeof Home }[] = [
  { view: 'my', label: '我的', icon: UserRound },
  { view: 'home', label: '发现', icon: Compass },
  { view: 'following', label: '关注', icon: Bookmark },
  { view: 'settings', label: '设置', icon: Settings2 },
]

/** 应用外壳：左侧导航和本人资料、顶部标题与返回入口；children 是当前业务页面。 */
export function AppShell({ profile, profileStats, activeView, darkMode, loading = false, onLogout, onToggleTheme, backAction, graphTitle, children }: AppShellProps) {
  // 让图搜索归到“发现”，图列表/图详情/发布/形成过程归到“我的”。
  const globalView = activeView === 'graph-search' ? 'home' : ['graphs', 'publish', 'graph', 'action-archive'].includes(activeView) ? 'my' : activeView
  // 每个 AppView 都必须有标题，新增路由时由 TypeScript 提醒补齐。
  const pageTitle: Record<AppView, string> = { my: '我的', following: '关注', home: '发现', settings: '设置', graph: graphTitle ?? '行动图', graphs: '行动图', publish: '记录行动', 'action-archive': '形成过程', profile: '主页', 'graph-search': '搜索图' }

  return (
    // 两栏布局：左侧固定导航，右侧是可滚动的主内容区。
    <div className="relative isolate mx-auto grid min-h-screen w-[min(1200px,calc(100%-72px))] grid-cols-[224px_minmax(0,880px)] gap-[62px] max-[1000px]:w-[min(920px,calc(100%-48px))] max-[1000px]:grid-cols-[190px_minmax(0,1fr)] max-[1000px]:gap-[38px]">
      <AppBackdrop />
      {/* ── 左侧栏：品牌、全局导航、资料与账户操作 ── */}
      <aside className="sticky top-0 flex h-screen flex-col py-[30px] pb-6">
        <a className="inline-flex w-max rounded-sm" href="#my" title="引序 我的"><Brand /></a>
        <nav className="mt-7 grid gap-1.5">
          {globalNavigation.map(({ view, label, icon: Icon }) => <a className={'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition hover:bg-soft hover:text-ink ' + (globalView === view ? 'bg-soft font-semibold text-signal' : 'text-muted')} href={'#' + view} key={view}><Icon size={19} strokeWidth={1.8} />{label}</a>)}
        </nav>
        {/* 底部：加载时隐藏资料卡和退出，只保留主题切换。 */}
        <div className="mt-auto grid gap-5">
          {!loading && profile && profileStats && <SidebarProfileCard profile={profile} stats={profileStats} />}
          <div className={loading ? 'grid gap-[7px]' : 'grid grid-cols-2 gap-[7px]'}><button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={onToggleTheme}><span className="inline-flex">{darkMode ? <Sun size={15} /> : <Moon size={15} />}</span>{darkMode ? '浅色模式' : '深色模式'}</button>{!loading && onLogout && <button className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-[7px] py-1.5 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral" type="button" onClick={onLogout}><span className="inline-flex"><LogOut size={15} /></span>退出登录</button>}</div>
        </div>
      </aside>
      {/* ── 主内容区 ── */}
      <main className={'relative min-w-0 pt-[30px] ' + (activeView === 'graph' ? 'pb-0' : 'pb-20')} id="top">
        {/* 图详情使用自己的 GraphHeader，返回按钮放在内容左侧；发布页使用工作区自己的标题；其余页面共用标题栏。 */}
        {activeView === 'graph' ? backAction && <div className="absolute -left-[38px] top-[30px] z-10"><BackButton label={backAction.label} onBack={backAction.onBack} /></div> : activeView === 'publish' ? null : <header className="flex min-h-[66px] items-center border-b border-line"><div className="relative min-w-0">{backAction && <div className="absolute right-full top-1/2 mr-2.5 flex -translate-y-1/2"><BackButton label={backAction.label} onBack={backAction.onBack} /></div>}<h1 className="text-[22px] font-semibold tracking-tight">{pageTitle[activeView]}</h1></div></header>}
        {/* 当前业务页面由 App 决定；这里只负责把它放进主内容区。 */}
        {children}
      </main>
    </div>
  )
}
