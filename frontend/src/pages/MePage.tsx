import { ArrowRight, CheckCircle2, CircleAlert, Eye, FolderKanban, Network } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CompletionHeatmap } from '@/entities/account/ui/CompletionHeatmap'
import { CustomProfileContent } from '@/entities/account/ui/CustomProfileContent'
import { isAcceptedRecord } from '@/entities/execution-node/model/selectors'
import { getMyContributions, type ContributionActivity } from '@/features/collaboration/api/client'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import type { Actor } from '@/entities/account/model/types'
import type { CompletionRecord } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'

type ProfileTab = 'default' | 'custom'

function initials(actor?: Actor) {
  return actor?.handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '你'
}

function ProfileAvatar({ actor, className = 'size-16' }: { actor?: Actor; className?: string }) {
  return actor?.avatarUrl ? (
    <img src={actor.avatarUrl} alt="" className={`${className} rounded-full border-4 border-surface bg-surface object-cover shadow-sm`} />
  ) : (
    <span className={`grid ${className} place-items-center rounded-full border-4 border-surface bg-inverse font-mono text-base font-semibold text-white shadow-sm`}>{initials(actor)}</span>
  )
}

function ProfileGender({ actor }: { actor?: Actor }) {
  if (actor?.gender === 'female') return <span className="font-mono text-base font-semibold leading-none text-clay" role="img" aria-label="女">♀</span>
  if (actor?.gender === 'male') return <span className="font-mono text-base font-semibold leading-none text-signal" role="img" aria-label="男">♂</span>
  return null
}

export function MePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const actors = useExecStore((state) => state.actors)
  const currentActorId = useExecStore((state) => state.currentActorId)
  const projects = useExecStore((state) => state.projects)
  const contracts = useExecStore((state) => state.contracts)
  const completionRecords = useExecStore((state) => state.completionRecords)
	const accessToken = useExecStore((state) => state.accessToken)
  const actor = actors.find((item) => item.id === currentActorId)
  const publicProjects = projects.filter((project) => project.visibility === 'public')
  const publicProjectIds = new Set(publicProjects.map((project) => project.id))
  const publicCompleted = completionRecords
    .filter((record) => publicProjectIds.has(record.projectId))
    .filter(isAcceptedRecord)
    .filter((record) => contracts.find((contract) => contract.id === record.closingContractId)?.actorId === currentActorId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  const activeDays = new Set(publicCompleted.map((record) => new Date(record.createdAt).toDateString())).size
  const customProfileEnabled = Boolean(actor?.customProfileEnabled)
	const [contributions, setContributions] = useState<ContributionActivity[]>([])
	const [contributionError, setContributionError] = useState('')
  const activeTab: ProfileTab = searchParams.get('tab') === 'custom' && customProfileEnabled ? 'custom' : 'default'
  const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: 'default', label: '默认' }, { id: 'custom', label: '自定' }]
  const profileBackgroundStyle = actor?.profileBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.22)),url(${JSON.stringify(actor.profileBackgroundUrl)})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }
    : undefined

  const selectTab = (tab: ProfileTab) => {
    setSearchParams(tab === 'custom' ? { tab: 'custom' } : {})
  }

	useEffect(() => {
		let alive = true
		if (!accessToken) return
		getMyContributions(accessToken)
			.then((data) => { if (alive) setContributions(data.contributions) })
			.catch((reason: Error) => { if (alive) setContributionError(reason.message) })
		return () => { alive = false }
	}, [accessToken])

  return (
    <div className="space-y-9">
      <section className="border-b border-rail pb-7">
        <div style={profileBackgroundStyle} className="h-36 overflow-hidden rounded-lg bg-[radial-gradient(circle_at_18%_18%,rgba(22,119,255,0.50),transparent_26%),radial-gradient(circle_at_78%_16%,rgba(46,139,87,0.38),transparent_28%),linear-gradient(135deg,rgb(var(--color-inverse)),rgb(var(--color-signal)))]" aria-hidden="true" />
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-5 px-4">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileAvatar actor={actor} className="size-20" />
            <div className="min-w-0 pb-1">
              <div className="font-mono text-xs font-semibold uppercase text-signal">Public profile</div>
              <h1 className="mt-2 truncate font-display text-4xl font-semibold leading-tight">{actor?.name ?? '你'}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-graphite">
                <span>{actor?.handle ?? '@you'}</span>
                <ProfileGender actor={actor} />
              </div>
            </div>
          </div>
        </div>
        {customProfileEnabled ? (
          <nav className="mt-6 flex gap-1 border-b border-rail" aria-label="公开主页内容">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={`inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${activeTab === tab.id ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}
      </section>

      {activeTab === 'default' ? (
        <>
          <div className="grid border-y border-rail sm:grid-cols-3">
            <ProfileFact label="公开项目" value={publicProjects.length} />
            <ProfileFact label="公开锁定" value={publicCompleted.length} />
            <ProfileFact label="活跃天数" value={activeDays} />
          </div>
          <CompletionHeatmap records={publicCompleted} />
			<ContributionActivitySection activities={contributions} error={contributionError} />
          <PublicProjectsSection projects={publicProjects} publicCompleted={publicCompleted} />
          <PublicRecordsSection records={publicCompleted} />
        </>
      ) : null}

      {activeTab === 'custom' ? (
        <section>
          {actor?.customProfileMarkdown?.trim() ? <CustomProfileContent content={actor.customProfileMarkdown} framed={false} /> : <p className="text-sm text-graphite">还没有自定义主页内容。</p>}
        </section>
      ) : null}
    </div>
  )
}

function ContributionActivitySection({ activities, error }: { activities: ContributionActivity[]; error: string }) {
  const adopted = activities.filter((activity) => activity.submission.status === 'adopted')
  const pending = activities.filter((activity) => activity.submission.status === 'submitted')
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rail pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />协作回流</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">我的成果后来怎么样了</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{adopted.length} 份已采纳 · {pending.length} 份等待审查</span>
      </div>
      {error ? <p className="border-l-2 border-clay py-3 pl-4 text-sm font-semibold text-clay">{error}</p> : null}
      {activities.length > 0 ? <div className="divide-y divide-rail border-b border-rail bg-surface/45">{activities.map((activity) => {
        const adoptedState = activity.submission.status === 'adopted'
        return <Link key={activity.submission.id} to={`/explore/projects/${activity.call.projectId}#call-${activity.call.id}`} className="grid gap-3 px-1 py-4 transition hover:bg-shell sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4 focus:outline-none focus-visible:shadow-focusline">
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{activity.submission.sourceTitle}</span><span className="mt-1 block text-xs leading-5 text-graphite">已接入「{activity.call.projectTitle}」的「{activity.call.title}」</span></span>
          <span className={adoptedState ? 'text-sm font-semibold text-moss' : 'text-sm font-semibold text-graphite'}>{adoptedState ? '已被采用，正在推动目标' : '已提交，等待组合审查'}</span>
        </Link>
      })}</div> : <p className="border-b border-rail py-5 text-sm leading-6 text-graphite">当你的成果被回交到其他公开项目后，采纳和后续状态会显示在这里。</p>}
    </section>
  )
}

function PublicProjectsSection({ projects, publicCompleted }: { projects: Project[]; publicCompleted: CompletionRecord[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rail pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><FolderKanban size={15} aria-hidden="true" />Public projects</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">公开项目</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{projects.length} 个可见项目</span>
      </div>
      <div className="grid gap-4 pt-5 lg:grid-cols-2">
        {projects.length > 0 ? projects.map((project) => <PublicProjectCard key={project.id} project={project} records={publicCompleted.filter((record) => record.projectId === project.id).length} />) : (
          <div className="flex items-center gap-2 border-y border-rail px-4 py-6 text-sm leading-6 text-graphite"><CircleAlert size={17} className="shrink-0 text-amber" aria-hidden="true" />还没有公开项目。</div>
        )}
      </div>
    </section>
  )
}

function PublicRecordsSection({ records }: { records: CompletionRecord[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rail pb-4">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">Locked record</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">公开锁定记录</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{records.length} 条不可变记录</span>
      </div>
      <div className="border-b border-rail bg-surface/45">
        {records.length > 0 ? records.map((record, index) => (
          <Link key={record.id} to={`/contracts/${record.closingContractId}`} className="grid gap-3 border-t border-rail px-1 py-4 transition hover:bg-shell sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center sm:px-4 focus:outline-none focus-visible:shadow-focusline">
            <span className="font-mono text-xs font-semibold text-signal">{String(records.length - index).padStart(2, '0')}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{record.title}</span><span className="mt-1 block text-xs leading-5 text-graphite"><CheckCircle2 size={13} className="mr-1 inline text-moss" aria-hidden="true" />覆盖 {record.coveredContractIds.length} 个推进节点 · {record.aiReviewVerdict === 'pass' ? 'AI 审查通过 · 用户确认' : 'AI 审查未通过 · 用户锁定'} · {new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))}</span></span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-signal">查看 <ArrowRight size={15} aria-hidden="true" /></span>
          </Link>
        )) : (
          <div className="flex items-center gap-2 px-4 py-6 text-sm leading-6 text-graphite"><CircleAlert size={17} className="shrink-0 text-amber" aria-hidden="true" />还没有公开锁定记录。</div>
        )}
      </div>
    </section>
  )
}

function PublicProjectCard({ project, records }: { project: Project; records: number }) {
  return (
    <Link to={`/projects/${project.id}`} className="group block border border-rail bg-surface/72 p-5 transition hover:border-graphite/40 hover:bg-shell focus:outline-none focus-visible:shadow-focusline">
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 truncate text-lg font-semibold text-ink group-hover:text-signal">{project.title}</h2>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-signal/25 bg-signal/10 px-2 py-1 text-xs font-semibold text-signal"><Eye size={13} aria-hidden="true" />公开</span>
      </div>
      {project.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p> : null}
      <div className="mt-4 flex items-center justify-between border-t border-rail pt-3 text-xs font-semibold text-graphite">
        <span>{records} 条锁定记录</span>
        <span className="inline-flex items-center gap-1 text-signal">查看项目<ArrowRight size={14} aria-hidden="true" /></span>
      </div>
    </Link>
  )
}

function ProfileFact({ label, value }: { label: string; value: number }) {
  return <div className="px-4 py-4 first:pl-0 sm:border-r sm:border-rail sm:last:border-r-0"><div className="font-mono text-[11px] font-semibold uppercase text-graphite">{label}</div><div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div></div>
}
