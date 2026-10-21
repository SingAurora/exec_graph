import type { UserProfile } from '../../entities/profile/model/types'
import { Avatar } from '../../shared/ui/Avatar'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { ProfileBiography } from '../../entities/profile/ui/ProfileBiography'
import { ProfileCover } from '../../entities/profile/ui/ProfileCover'

/** Personal content totals, using the same definitions as the public profile. */
export type SidebarProfileStats = {
  actions: number
  expressions: number
  agreements: number
}

/** Identifies the signed-in account and links to its public content categories. */
export function SidebarProfileCard({ profile, stats }: { profile: UserProfile; stats: SidebarProfileStats }) {
  const profileHref = '#profile?userId=' + encodeURIComponent(profile.id)
  const categories = [
    { tab: 'expressions', label: '表达', count: stats.expressions },
    { tab: 'agreements', label: '约定', count: stats.agreements },
    { tab: 'actions', label: '行动', count: stats.actions },
  ]
  return <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-label="个人资料">
    <ProfileCover image={profile.backgroundImage} size="sidebar" />
    <div className="px-3 pb-3">
      <a className="relative -mt-7 inline-flex rounded-full border-4 border-surface bg-surface align-top focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={profileHref} aria-label={`查看${profile.name}的主页`}><Avatar profile={profile} size="profile" shape="circle" /></a>
      <div className="mt-1.5 grid min-w-0 gap-0.5 pl-1">
        <a className="flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-semibold hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={profileHref} title={profile.name}><span className="min-w-0 truncate">{profile.name}</span><span className="shrink-0"><GenderMark gender={profile.gender} /></span></a>
        <span className="truncate text-xs text-muted" title={profile.email}>{profile.email}</span>
      </div>
      {profile.bio.trim() && <div className="mt-3"><ProfileBiography biography={profile.bio} compact /></div>}
      <nav className="mt-3 grid grid-cols-3 gap-1.5" aria-label="个人内容快捷入口">
        {categories.map(({ tab, label, count }) => <a className="group grid min-w-0 gap-1 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={profileHref + '&tab=' + tab} aria-label={`查看全部${label}，共 ${count} 条`} key={tab}>
          <strong className="truncate text-[18px] font-semibold leading-5 text-ink tabular-nums group-hover:text-signal">{count}</strong>
          <span className="text-[11px] text-muted group-hover:text-signal">{label}</span>
        </a>)}
      </nav>
    </div>
  </section>
}
