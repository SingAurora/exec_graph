import { ArrowRight, Compass, Network, Search, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicNetworkGraph, type PublicNetworkView } from '@/widgets/explore/ui/PublicNetworkGraph'
import { getPublicCollaborationNetwork, listPublicProjects, type CollaborationCall, type ExploreProject, type PublicNetwork } from '@/features/collaboration/api/client'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'

export function ExploreScreen() {
  const token = useExecStore((state) => state.accessToken)
  const [projects, setProjects] = useState<ExploreProject[]>([])
  const [network, setNetwork] = useState<PublicNetwork | null>(null)
  const [networkView, setNetworkView] = useState<PublicNetworkView>('projects')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([listPublicProjects(token), getPublicCollaborationNetwork(token)]).then(([projectData, networkData]) => { if (alive) { setProjects(projectData.projects); setNetwork(networkData) } }).catch((reason: Error) => {
      if (!alive) return
      setError(reason.message)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleProjects = useMemo(() => projects.filter((project) => !normalizedQuery || [project.title, project.description, project.ownerName, ...project.calls.map((call) => call.title)].some((value) => value.toLowerCase().includes(normalizedQuery))), [projects, normalizedQuery])
  const openCalls = visibleProjects.flatMap((project) => project.calls.filter((call) => call.status === 'open')).sort((left, right) => left.submissionCount - right.submissionCount)

  return <div className="space-y-9">
    <section className="border-b border-rail pb-7"><div className="flex flex-wrap items-end justify-between gap-5"><div><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Compass size={15} />协作探索</div><h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink">从成果流动里找到值得接住的事</h1></div><label className="relative block w-full sm:w-80"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索项目或开放缺口" className="h-10 w-full border border-rail bg-surface/72 pl-10 pr-3 text-sm outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline" /></label></div></section>
    {loading ? <p className="text-sm text-graphite">正在读取公开协作...</p> : null}
    {error ? <p className="border-l-2 border-clay py-2 pl-4 text-sm font-semibold text-clay">{error}</p> : null}
    {network ? <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />执行网络</div><h2 className="mt-2 font-display text-3xl font-semibold">先看关系，再进入具体成果</h2></div><div className="flex border border-rail bg-surface p-1"><NetworkViewButton active={networkView === 'projects'} onClick={() => setNetworkView('projects')} label="项目" /><NetworkViewButton active={networkView === 'people'} onClick={() => setNetworkView('people')} label="人物" /><NetworkViewButton active={networkView === 'records'} onClick={() => setNetworkView('records')} label="成果" /></div></div><PublicNetworkGraph network={network} view={networkView} /><div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-rail py-3 text-xs font-semibold text-graphite"><span><i className="mr-2 inline-block size-2.5 rounded-sm bg-surface ring-2 ring-rail" />项目</span><span><i className="mr-2 inline-block size-2.5 rounded-full bg-signal" />执行者</span><span><i className="mr-2 inline-block size-2.5 border-2 border-moss bg-surface" />成果</span><span><i className="mr-2 inline-block h-0 w-5 border-t-2 border-moss" />正式采纳</span><span><i className="mr-2 inline-block h-0 w-5 border-t-2 border-dashed border-amber" />正在贡献</span></div></section> : null}
    {openCalls.length > 0 ? <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="font-mono text-xs font-semibold uppercase text-signal">Open gaps</div><h2 className="mt-2 font-display text-3xl font-semibold">现在可以补上的缺口</h2></div><span className="text-sm font-semibold text-graphite">{openCalls.length} 个开放缺口</span></div><div className="grid gap-4 xl:grid-cols-2">{openCalls.map((call) => <OpenCallCard key={call.uuid} call={call} />)}</div></section> : null}
    <section className="space-y-4 border-t border-rail pt-8"><div><div className="font-mono text-xs font-semibold uppercase text-signal">Shared problems</div><h2 className="mt-2 font-display text-3xl font-semibold">正在共同解决的问题</h2></div><div className="grid gap-4 lg:grid-cols-2">{visibleProjects.map((project) => <ProjectStoryCard key={project.uuid} project={project} />)}</div>{!loading && visibleProjects.length === 0 ? <div className="border-l-2 border-rail py-5 pl-4 text-sm leading-6 text-graphite">还没有公开协作项目。把项目设为公开，并为一个冻结节点发布开放缺口后，它会出现在这里。</div> : null}</section>
    <section className="grid gap-5 border-y border-rail py-7 md:grid-cols-[auto_minmax(0,1fr)]"><Network className="text-signal" size={24} /><div><h2 className="text-lg font-semibold text-ink">只展示已经发生的协作关系</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">贡献提交、AI 组合审查和维护者采纳都会留下来源关系。被采用的成果始终属于原作者，后续项目只能引用，不能改写。</p></div></section>
  </div>
}

function NetworkViewButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`h-8 px-3 text-sm font-semibold transition ${active ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}>{label}网络</button>
}

function OpenCallCard({ call }: { call: CollaborationCall }) {
  const slots = Math.max(0, call.maxSubmissions - call.submissionCount)
  return <article className="border border-rail bg-surface p-5 transition hover:border-signal/50"><div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/explore/projects/${call.projectUuid}`} className="text-xs font-semibold text-graphite hover:text-ink">{call.projectTitle}</Link><span className="font-mono text-xs font-semibold text-signal">还可接收 {slots} 份</span></div><h3 className="mt-4 text-xl font-semibold leading-7 text-ink">{call.title}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-graphite">{call.target.verifiableGoal}</p><div className="mt-5 border-y border-rail py-3 text-xs leading-5 text-graphite"><span className="font-semibold text-ink">完成后解锁：</span>为「{call.projectTitle}」补上一份可供维护者组合验收的来源成果。</div><div className="mt-4 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-graphite"><UsersRound size={14} />{call.submissionCount} 份已提交</span><Link to={`/explore/projects/${call.projectUuid}#call-${call.uuid}`} className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink">查看缺口<ArrowRight size={15} /></Link></div></article>
}

function ProjectStoryCard({ project }: { project: ExploreProject }) {
  return <article className="border border-rail bg-surface p-5 transition hover:border-graphite/40"><div className="flex items-center justify-between gap-3 text-xs font-semibold text-graphite"><span>@{project.ownerUserId} 发起</span><span className="text-signal">{project.openCallCount} 个开放缺口</span></div><Link to={`/explore/projects/${project.uuid}`} className="group mt-4 block focus:outline-none focus-visible:shadow-focusline"><h2 className="font-display text-2xl font-semibold leading-tight text-ink group-hover:text-signal">{project.title}</h2>{project.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p> : null}</Link><div className="mt-5 grid grid-cols-2 border-y border-rail py-3 text-xs"><span className="text-graphite"><b className="text-ink">{project.acceptedCount}</b> 条已采纳成果</span><span className="text-right text-graphite"><b className="text-ink">{project.nodeCount}</b> 个行动节点</span></div><Link to={`/explore/projects/${project.uuid}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink">查看协作过程<ArrowRight size={15} /></Link></article>
}
