import { ArrowRight, CheckCircle2, Circle, CircleAlert, Compass, GitBranch, GitFork, LockKeyhole } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { memberInitials, publicCompletions, publicMember, publicProjects } from '../data/explore'

const shortDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value))

export function PublicProjectPage() {
  const { projectId = '' } = useParams()
  const project = publicProjects.find((item) => item.id === projectId)

  if (!project) {
    return <div className="border-l-2 border-rail py-4 pl-5"><h1 className="font-display text-3xl font-semibold text-ink">找不到公开项目</h1><Link to="/explore" className="mt-4 inline-flex text-sm font-semibold text-signal hover:text-ink">返回公开项目</Link></div>
  }

  const owner = publicMember(project.ownerHandle)
  const records = publicCompletions.filter((record) => record.projectID === project.id)

  return (
    <div className="space-y-9">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline"><Compass size={15} aria-hidden="true" />公开项目</Link>
          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-signal"><span>公开项目</span><span>·</span><span>{project.smartContract}</span></div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink">{project.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-graphite">{project.description}</p>
        </div>
        {owner ? <Link to={`/u/${owner.handle.replace('@', '')}`} className="flex items-center gap-3 self-start border-l-2 border-signal py-2 pl-4 focus:outline-none focus-visible:shadow-focusline"><span className={`grid size-10 place-items-center rounded-full font-mono text-xs font-semibold text-white ${owner.color}`}>{memberInitials(owner)}</span><span><span className="block text-sm font-semibold text-ink">{owner.name}</span><span className="mt-1 block text-xs text-graphite">{owner.handle}</span></span></Link> : null}
      </section>

      <section className="grid grid-cols-3 divide-x divide-rail border-y border-rail"><ProjectMetric label="节点" value={project.nodeCount} /><ProjectMetric label="锁定记录" value={project.completionCount} /><ProjectMetric label="推进路径" value={project.branchCount} /></section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><GitBranch size={15} aria-hidden="true" />公开节点路径</div>
          <div className="mt-5 border-l border-rail pl-5">
            {project.path.map((node, index) => {
              const Icon = node.state === 'locked' ? CheckCircle2 : node.state === 'reviewing' ? CircleAlert : Circle
              const color = node.state === 'locked' ? 'text-moss' : node.state === 'reviewing' ? 'text-clay' : 'text-signal'
              const state = node.state === 'locked' ? '已锁定' : node.state === 'reviewing' ? 'AI 审核中' : '待推进'
              return <div key={node.title} className="relative pb-7 last:pb-0"><Icon size={18} className={`absolute -left-[35px] top-0 bg-paper ${color}`} aria-hidden="true" /><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-ink">{node.title}</h2><span className={`font-mono text-xs font-semibold ${color}`}>{state}</span></div>{index < project.path.length - 1 ? <p className="mt-2 text-sm text-graphite">下一项推进以此节点的锁定记录为依据。</p> : null}</div>
            })}
          </div>
        </div>
        <aside className="border border-rail bg-shell p-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><LockKeyhole size={15} aria-hidden="true" />项目智能合约</div><h2 className="mt-3 text-lg font-semibold text-ink">{project.smartContract}</h2><p className="mt-3 text-sm leading-6 text-graphite">公开项目展示已冻结的节点规则、审查结论和锁定记录。项目所有者仍决定下一项推进。</p><div className="mt-5 border-t border-rail pt-4 text-xs font-semibold text-graphite">最近锁定于 {shortDate(project.latestLockedAt)}</div></aside>
      </section>

      <section className="border-y border-rail bg-surface/50"><div className="flex items-center gap-2 border-b border-rail px-5 py-4 font-mono text-xs font-semibold uppercase text-signal"><GitFork size={15} aria-hidden="true" />完成记录</div>{records.map((record) => <div key={record.id} className="grid gap-3 border-b border-rail px-5 py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]"><div><h2 className="text-sm font-semibold text-ink">{record.title}</h2><p className="mt-2 text-sm leading-6 text-graphite">{record.summary}</p></div><span className={`inline-flex h-fit items-center gap-1 text-xs font-semibold ${record.aiPassed ? 'text-moss' : 'text-clay'}`}>{record.aiPassed ? <CheckCircle2 size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}{record.aiPassed ? 'AI 通过' : 'AI 未通过后锁定'}<ArrowRight size={13} aria-hidden="true" /></span></div>)}</section>
    </div>
  )
}

function ProjectMetric({ label, value }: { label: string; value: number }) {
  return <div className="px-4 py-4 text-center first:text-left last:text-right"><div className="text-xs font-semibold text-graphite">{label}</div><div className="mt-1 text-xl font-semibold text-ink">{value}</div></div>
}
