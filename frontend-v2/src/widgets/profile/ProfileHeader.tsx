import type { AppView, UserProfile } from '../../shared/model'
import { Avatar } from '../../shared/ui/Avatar'

type ProfileHeaderProps = {
  profile: UserProfile
  activeCount: number
  completedCount: number
  activeView: AppView
}

export function ProfileHeader({ profile, activeCount, completedCount, activeView }: ProfileHeaderProps) {
  return <section className="pt-[22px]"><div className="flex items-center justify-between gap-[18px] max-[700px]:items-start"><div className="flex items-center gap-4"><Avatar profile={profile} size="large" /><div><div className="eyebrow">个人页面</div><h2 className="mt-1 font-sans text-[26px] tracking-[-.04em]">{profile.name}</h2><p className="text-xs text-muted">{profile.email}</p></div></div><a className="quiet-button" href="#settings">编辑资料</a></div><p className="mt-5 mb-3.5 ml-[84px] text-sm leading-[1.6] text-muted max-[700px]:ml-0 max-[700px]:mt-[17px]">{profile.bio}</p><div className="ml-[84px] flex flex-wrap gap-[21px] text-xs text-muted max-[700px]:ml-0 max-[700px]:gap-[13px]"><span><strong className="text-[13px] text-ink">{activeCount}</strong> 项进行中</span><span><strong className="text-[13px] text-ink">{completedCount}</strong> 条完成记录</span><span>加入于 2026 年</span></div><nav className="mt-[25px] flex gap-[26px] border-b border-line max-[700px]:gap-[18px]" aria-label="个人内容"><a className={`border-b-2 border-transparent px-0.5 pb-[11px] pt-[13px] text-[13px] font-semibold text-muted hover:border-signal hover:text-ink ${activeView === 'my' ? 'border-signal text-ink' : ''}`} href="#my">进行中</a><a className={`border-b-2 border-transparent px-0.5 pb-[11px] pt-[13px] text-[13px] font-semibold text-muted hover:border-signal hover:text-ink ${activeView === 'home' ? 'border-signal text-ink' : ''}`} href="#my?tab=completed">已完成</a></nav></section>
}
