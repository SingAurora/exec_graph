import { ArrowRight, CheckCircle2, CircleAlert, Compass, FolderKanban, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getPublicUserProfile } from '@/entities/account/api/client'
import type { PublicProfile, PublicProfileCompletion, PublicProfileProject, PublicProfileUser } from '@/entities/account/model/types'
import { CompletionHeatmap } from '@/entities/account/ui/CompletionHeatmap'
import { CustomProfileContent } from '@/entities/account/ui/CustomProfileContent'

type ProfileTab = 'default' | 'custom'

export function PublicProfileScreen({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setProfile(null)
    getPublicUserProfile(userId)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-graphite"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />正在读取公开主页</div>
  }

  if (!profile) {
    return <div className="border-l-2 border-clay py-4 pl-5"><h1 className="font-display text-3xl font-semibold text-ink">找不到这位用户</h1><p className="mt-2 text-sm leading-6 text-graphite">{error || '该公开主页不存在或暂时无法访问。'}</p><Link to="/explore?tab=people" className="mt-4 inline-flex text-sm font-semibold text-signal hover:text-ink">返回探索</Link></div>
  }

  const customProfileEnabled = profile.user.customProfileEnabled
  const activeTab: ProfileTab = searchParams.get('tab') === 'custom' && customProfileEnabled ? 'custom' : 'default'
  const selectTab = (tab: ProfileTab) => setSearchParams(tab === 'custom' ? { tab: 'custom' } : {})

  return (
    <div className="space-y-9">
      <ProfileHeader user={profile.user} />
      {customProfileEnabled ? (
        <nav className="-mt-9 flex gap-1 border-b border-rail" aria-label="公开主页内容">
          <button type="button" onClick={() => selectTab('default')} className={tabClassName(activeTab === 'default')}>默认</button>
          <button type="button" onClick={() => selectTab('custom')} className={tabClassName(activeTab === 'custom')}>自定</button>
        </nav>
      ) : null}

      {activeTab === 'default' ? (
        <>
          <dl className="grid border-y border-rail sm:grid-cols-3">
            <ProfileMetric label="公开项目" value={profile.projects.length} />
            <ProfileMetric label="公开成果" value={profile.records.length} />
            <ProfileMetric label="活跃天数" value={profile.activeDays} />
          </dl>
          <CompletionHeatmap records={profile.records} />
          <PublicProjectsSection projects={profile.projects} />
          <PublicRecordsSection records={profile.records} />
        </>
      ) : null}

      {activeTab === 'custom' ? (
        <section>
          {profile.user.customProfileMarkdown?.trim() ? <CustomProfileContent content={profile.user.customProfileMarkdown} framed={false} /> : <p className="text-sm text-graphite">还没有自定义主页内容。</p>}
        </section>
      ) : null}
    </div>
  )
}

function ProfileHeader({ user }: { user: PublicProfileUser }) {
  const backgroundStyle = user.profileBackgroundUrl
    ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.22)),url(${JSON.stringify(user.profileBackgroundUrl)})`, backgroundPosition: 'center', backgroundSize: 'cover' }
    : undefined
  return (
    <section className="border-b border-rail pb-7">
      <Link to="/explore?tab=people" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Compass size={15} aria-hidden="true" />探索网络</Link>
      <div style={backgroundStyle} className="mt-5 h-36 overflow-hidden rounded-lg bg-[radial-gradient(circle_at_18%_18%,rgba(22,119,255,0.50),transparent_26%),radial-gradient(circle_at_78%_16%,rgba(46,139,87,0.38),transparent_28%),linear-gradient(135deg,rgb(var(--color-inverse)),rgb(var(--color-signal)))]" aria-hidden="true" />
      <div className="-mt-8 flex min-w-0 items-end gap-4 px-4">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-20 shrink-0 rounded-full border-4 border-surface bg-surface object-cover shadow-sm" /> : <span className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-surface bg-inverse font-mono text-base font-semibold text-white shadow-sm">{initials(user)}</span>}
        <div className="min-w-0 pb-1"><h1 className="truncate font-display text-4xl font-semibold leading-tight text-ink">{user.username}</h1><div className="mt-1 flex items-center gap-2 text-sm font-semibold text-graphite"><span>@{user.userId}</span><ProfileGender gender={user.gender} /></div></div>
      </div>
      {user.bio ? <p className="mt-5 max-w-2xl px-4 text-sm leading-6 text-graphite">{user.bio}</p> : null}
    </section>
  )
}

function PublicProjectsSection({ projects }: { projects: PublicProfileProject[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rail pb-4"><div><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><FolderKanban size={15} aria-hidden="true" />Public projects</div><h2 className="mt-2 font-display text-2xl font-semibold">公开项目</h2></div><span className="text-sm font-semibold text-graphite">{projects.length} 个可见项目</span></div>
      <div className="grid gap-4 pt-5 lg:grid-cols-2">
        {projects.length > 0 ? projects.map((project) => <Link key={project.uuid} to={`/explore/projects/${project.uuid}`} className="group block border border-rail bg-surface/72 p-5 transition hover:border-graphite/40 hover:bg-shell focus:outline-none focus-visible:shadow-focusline"><h3 className="text-lg font-semibold text-ink group-hover:text-signal">{project.title}</h3>{project.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p> : null}<div className="mt-4 flex items-center justify-between gap-3 border-t border-rail pt-3 text-xs font-semibold text-graphite"><span>{project.nodeCount} 个节点 · {project.completionCount} 份成果</span><span className="inline-flex shrink-0 items-center gap-1 text-signal">查看项目<ArrowRight size={14} aria-hidden="true" /></span></div></Link>) : <EmptyState>还没有公开项目。</EmptyState>}
      </div>
    </section>
  )
}

function PublicRecordsSection({ records }: { records: PublicProfileCompletion[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rail pb-4"><div><div className="font-mono text-xs font-semibold uppercase text-signal">Accepted outcomes</div><h2 className="mt-2 font-display text-2xl font-semibold">最近成果</h2></div><span className="text-sm font-semibold text-graphite">{records.length} 份已验收成果</span></div>
      {records.length > 0 ? <div className="border-b border-rail bg-surface/45">{records.map((record) => <Link key={record.uuid} to={`/explore/projects/${record.projectUuid}`} className="group grid gap-3 border-t border-rail px-1 py-4 transition hover:bg-shell sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4 focus:outline-none focus-visible:shadow-focusline"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink group-hover:text-signal">{record.title}</span><span className="mt-1 block text-xs leading-5 text-graphite">{record.projectTitle} · 覆盖 {record.coveredContractCount} 个推进节点{record.summary ? ` · ${record.summary}` : ''}</span></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-moss"><CheckCircle2 size={14} aria-hidden="true" />{shortDate(record.createdAt)}</span></Link>)}</div> : <EmptyState>还没有公开成果。</EmptyState>}
    </section>
  )
}

function EmptyState({ children }: { children: string }) {
  return <div className="flex items-center gap-2 border-y border-rail px-4 py-6 text-sm leading-6 text-graphite"><CircleAlert size={17} className="shrink-0 text-amber" aria-hidden="true" />{children}</div>
}

function ProfileMetric({ label, value }: { label: string; value: number }) {
  return <div className="px-4 py-4 first:pl-0 sm:border-r sm:border-rail sm:last:border-r-0"><dt className="font-mono text-[11px] font-semibold uppercase text-graphite">{label}</dt><dd className="mt-1 font-display text-2xl font-semibold text-ink">{value}</dd></div>
}

function ProfileGender({ gender }: Pick<PublicProfileUser, 'gender'>) {
  if (gender === 'female') return <span className="font-mono text-base font-semibold leading-none text-clay" role="img" aria-label="女">♀</span>
  if (gender === 'male') return <span className="font-mono text-base font-semibold leading-none text-signal" role="img" aria-label="男">♂</span>
  return null
}

function initials(user: PublicProfileUser) {
  return user.username.trim().slice(0, 2).toUpperCase() || user.userId.slice(0, 2).toUpperCase()
}

function tabClassName(active: boolean) {
  return `inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${active ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`
}

const shortDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value))
