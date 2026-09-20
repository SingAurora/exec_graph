import { ArrowRight, CheckCircle2, Compass, FolderKanban } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CompletionHeatmap } from '@/entities/account/ui/CompletionHeatmap'
import { memberInitials, publicCompletions, publicMember, publicProjects } from '../data/explore'

const shortDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))

export function PublicProfilePage() {
  const { handle = '' } = useParams()
  const member = publicMember(handle)

  if (!member) {
    return <div className="border-l-2 border-rail py-4 pl-5"><h1 className="font-display text-3xl font-semibold text-ink">找不到这位开发者</h1><Link to="/explore?tab=people" className="mt-4 inline-flex text-sm font-semibold text-signal hover:text-ink">返回开发者列表</Link></div>
  }

  const projects = publicProjects.filter((project) => project.ownerHandle === member.handle)
  const records = publicCompletions.filter((record) => record.ownerHandle === member.handle)

  return (
    <div className="space-y-9">
      <section className="border-b border-rail pb-7">
        <Link to="/explore?tab=people" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Compass size={15} aria-hidden="true" />探索开发者</Link>
        <div className="mt-5 flex flex-wrap items-start gap-5">
          <span className={`grid size-20 shrink-0 place-items-center rounded-full font-mono text-xl font-semibold text-white ${member.color}`}>{memberInitials(member)}</span>
          <div className="min-w-0 flex-1"><h1 className="font-display text-4xl font-semibold leading-tight text-ink">{member.name}</h1><p className="mt-1 text-sm text-graphite">{member.handle} · {member.role}</p><p className="mt-4 max-w-2xl text-sm leading-6 text-graphite">{member.bio}</p></div>
        </div>
        <dl className="mt-7 grid max-w-2xl grid-cols-3 divide-x divide-rail border-y border-rail"><ProfileMetric label="公开项目" value={member.projectCount} /><ProfileMetric label="锁定记录" value={member.completionCount} /><ProfileMetric label="年度活跃" value={`${member.activeDays} 天`} /></dl>
      </section>

      <CompletionHeatmap records={records} />

      <section className="space-y-4"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><FolderKanban size={15} aria-hidden="true" />公开项目</div><div className="grid gap-4 lg:grid-cols-2">{projects.map((project) => <Link key={project.id} to={`/explore/projects/${project.id}`} className="group block border border-rail bg-surface/72 p-5 transition hover:border-graphite/40 hover:bg-shell focus:outline-none focus-visible:shadow-focusline"><h2 className="text-lg font-semibold text-ink group-hover:text-signal">{project.title}</h2>{project.description ? <p className="mt-2 text-sm leading-6 text-graphite">{project.description}</p> : null}<div className="mt-4 flex items-center justify-between border-t border-rail pt-3 text-xs font-semibold text-graphite"><span>{project.nodeCount} 个节点 · {project.completionCount} 条锁定记录</span><span className="inline-flex items-center gap-1 text-signal">查看项目<ArrowRight size={14} aria-hidden="true" /></span></div></Link>)}</div></section>

      <section className="border-y border-rail bg-surface/50"><div className="border-b border-rail px-5 py-4 font-mono text-xs font-semibold uppercase text-signal">最近锁定</div>{records.map((record) => <Link key={record.id} to={`/explore/projects/${record.projectID}`} className="group flex items-start justify-between gap-4 border-b border-rail px-5 py-4 last:border-b-0 transition hover:bg-shell focus:outline-none focus-visible:shadow-focusline"><div className="min-w-0"><h2 className="text-sm font-semibold text-ink group-hover:text-signal">{record.title}</h2><p className="mt-1 line-clamp-1 text-sm text-graphite">{record.summary}</p></div><span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-moss"><CheckCircle2 size={14} aria-hidden="true" />{shortDate(record.createdAt)}</span></Link>)}</section>
    </div>
  )
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="px-4 py-4 first:pl-0"><dt className="text-xs font-semibold text-graphite">{label}</dt><dd className="mt-1 text-lg font-semibold text-ink">{value}</dd></div>
}
