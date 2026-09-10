import { ArrowRight, CheckCircle2, CircleAlert, Compass, Network, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { memberInitials, publicCompletions, publicMember, publicMembers, publicProjects, type PublicCompletion, type PublicMember, type PublicProject } from '../data/explore'
import { PublicNetworkGraph } from '../components/PublicNetworkGraph'

type ExploreTab = 'projects' | 'records' | 'people' | 'calls' | 'network'

const tabs: Array<{ id: ExploreTab; label: string }> = [
  { id: 'projects', label: '公开项目' },
  { id: 'records', label: '完成记录' },
  { id: 'people', label: '开发者' },
  { id: 'calls', label: '协作征集' },
  { id: 'network', label: '执行网络' },
]

const exploreTab = (value: string | null): ExploreTab => value === 'records' || value === 'people' || value === 'calls' || value === 'network' ? value : 'projects'

type CollaborationCall = {
  id: string
  projectID: string
  projectTitle: string
  ownerHandle: string
  title: string
  criteria: string
  applications: number
  remainingReviews: number
  mode: '公开征集' | '仅邀请'
}

const collaborationCalls: CollaborationCall[] = [
  {
    id: 'call-reading-explanation',
    projectID: 'public-reading-system',
    projectTitle: '构建可复查的阅读系统',
    ownerHandle: '@linzhou',
    title: '补足摘录到输出的真实回溯案例',
    criteria: '提供一条从摘录、索引到实际输出的完整证据路径。',
    applications: 2,
    remainingReviews: 3,
    mode: '公开征集',
  },
  {
    id: 'call-lab-calibration',
    projectID: 'public-home-lab',
    projectTitle: '一人家庭实验室',
    ownerHandle: '@qiaoye',
    title: '补足传感器校准误差的复查材料',
    criteria: '说明误差来源，给出一次校准前后的对照记录。',
    applications: 1,
    remainingReviews: 2,
    mode: '公开征集',
  },
  {
    id: 'call-research-source',
    projectID: 'public-research-map',
    projectTitle: 'AI 产品审查研究图谱',
    ownerHandle: '@mori',
    title: '整理可复查的审查失败案例',
    criteria: '提供原始来源、失败原因和可定位的引用位置。',
    applications: 0,
    remainingReviews: 0,
    mode: '仅邀请',
  },
]

const shortDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))

export function ExplorePage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const activeTab = exploreTab(searchParams.get('tab'))
  const normalizedQuery = query.trim().toLowerCase()
  const projects = publicProjects.filter((project) => matches(normalizedQuery, [project.title, project.description, publicMember(project.ownerHandle)?.name ?? '', project.smartContract]))
  const records = publicCompletions.filter((record) => matches(normalizedQuery, [record.title, record.summary, record.projectTitle, publicMember(record.ownerHandle)?.name ?? '']))
  const members = publicMembers.filter((member) => matches(normalizedQuery, [member.name, member.handle, member.role, member.bio]))
  const calls = collaborationCalls.filter((call) => matches(normalizedQuery, [call.title, call.criteria, call.projectTitle, publicMember(call.ownerHandle)?.name ?? '']))

  return (
    <div className="space-y-8">
      <section className="border-b border-rail pb-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Compass size={15} aria-hidden="true" />探索</div>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">从他人的成果继续推进</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">阅读已经锁定的成果，找到正在征集的目标，并追踪成果如何进入新的项目。</p>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索项目、记录或开发者" className="h-10 w-full border border-rail bg-surface/72 pl-10 pr-3 text-sm outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline" />
          </label>
        </div>
      </section>

      <nav className="flex gap-1 overflow-x-auto border-b border-rail" aria-label="探索内容">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return <Link key={tab.id} to={tab.id === 'projects' ? '/explore' : `/explore?tab=${tab.id}`} className={`inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${active ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}>{tab.label}</Link>
        })}
      </nav>

      {activeTab === 'projects' ? <PublicProjects projects={projects} /> : null}
      {activeTab === 'records' ? <PublicRecords records={records} /> : null}
      {activeTab === 'people' ? <PublicPeople members={members} /> : null}
      {activeTab === 'calls' ? <CollaborationCalls calls={calls} /> : null}
      {activeTab === 'network' ? <ExecutionNetwork /> : null}
    </div>
  )
}

function PublicProjects({ projects }: { projects: PublicProject[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {projects.length > 0 ? projects.map((project) => <PublicProjectCard key={project.id} project={project} />) : <EmptyState />}
    </section>
  )
}

function PublicProjectCard({ project }: { project: PublicProject }) {
  const owner = publicMember(project.ownerHandle)
  return (
    <article className="flex min-w-0 flex-col border border-rail bg-surface p-5 transition hover:border-signal/50">
      <div className="flex items-start justify-between gap-4">
        <Link to={`/u/${project.ownerHandle.replace('@', '')}`} className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-graphite hover:text-ink focus:outline-none focus-visible:shadow-focusline">
          {owner ? <MemberAvatar member={owner} size="size-7" /> : null}
          <span className="truncate">{owner?.name ?? project.ownerHandle}</span>
        </Link>
        <span className="shrink-0 font-mono text-xs font-semibold text-signal">公开</span>
      </div>
      <Link to={`/explore/projects/${project.id}`} className="group mt-5 focus:outline-none focus-visible:shadow-focusline">
        <h2 className="font-display text-2xl font-semibold leading-tight text-ink transition group-hover:text-signal">{project.title}</h2>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-graphite">{project.description}</p>
      </Link>
      <div className="mt-5 grid grid-cols-3 border-y border-rail py-3 text-xs text-graphite">
        <Metric label="节点" value={project.nodeCount} />
        <Metric label="已锁定" value={project.completionCount} />
        <Metric label="路径" value={project.branchCount} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="truncate text-xs font-semibold text-graphite">{project.smartContract}</span>
        <Link to={`/explore/projects/${project.id}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline">查看项目<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </article>
  )
}

function PublicRecords({ records }: { records: PublicCompletion[] }) {
  return (
    <section className="border-y border-rail bg-surface/50">
      {records.length > 0 ? records.map((record) => <PublicRecordRow key={record.id} record={record} />) : <EmptyState />}
    </section>
  )
}

function PublicRecordRow({ record }: { record: PublicCompletion }) {
  const owner = publicMember(record.ownerHandle)
  const VerdictIcon = record.aiPassed ? CheckCircle2 : CircleAlert
  return (
    <article className="grid gap-4 border-b border-rail p-5 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
      {owner ? <Link to={`/u/${owner.handle.replace('@', '')}`} className="focus:outline-none focus-visible:shadow-focusline"><MemberAvatar member={owner} size="size-10" /></Link> : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-graphite"><Link to={`/u/${record.ownerHandle.replace('@', '')}`} className="text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline">{owner?.name ?? record.ownerHandle}</Link><span>在</span><Link to={`/explore/projects/${record.projectID}`} className="truncate hover:text-ink focus:outline-none focus-visible:shadow-focusline">{record.projectTitle}</Link><span>锁定了记录</span></div>
        <h2 className="mt-2 text-lg font-semibold text-ink">{record.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{record.summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-graphite md:flex-col md:items-end">
        <span className={`inline-flex items-center gap-1 ${record.aiPassed ? 'text-moss' : 'text-clay'}`}><VerdictIcon size={14} aria-hidden="true" />{record.aiPassed ? 'AI 通过' : 'AI 未通过后锁定'}</span>
        <span>{record.coveredNodeCount} 个节点 · {shortDate(record.createdAt)}</span>
      </div>
    </article>
  )
}

function PublicPeople({ members }: { members: PublicMember[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {members.length > 0 ? members.map((member) => <Link key={member.handle} to={`/u/${member.handle.replace('@', '')}`} className="group block border border-rail bg-surface/72 p-5 transition hover:border-graphite/40 hover:bg-shell focus:outline-none focus-visible:shadow-focusline">
        <div className="flex items-start gap-3"><MemberAvatar member={member} size="size-11" /><div className="min-w-0"><h2 className="text-lg font-semibold text-ink group-hover:text-signal">{member.name}</h2><p className="mt-0.5 text-sm text-graphite">{member.role} · {member.handle}</p></div></div>
        <p className="mt-4 min-h-12 text-sm leading-6 text-graphite">{member.bio}</p>
        <div className="mt-5 grid grid-cols-3 border-t border-rail pt-3"><Metric label="项目" value={member.projectCount} /><Metric label="锁定" value={member.completionCount} /><Metric label="活跃天" value={member.activeDays} /></div>
      </Link>) : <EmptyState />}
    </section>
  )
}

function CollaborationCalls({ calls }: { calls: CollaborationCall[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {calls.length > 0 ? calls.map((call) => {
        const owner = publicMember(call.ownerHandle)
        const isOpen = call.mode === '公开征集' && call.remainingReviews > 0
        return (
          <article key={call.id} className="border border-rail bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/explore/projects/${call.projectID}`} className="truncate text-xs font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">{call.projectTitle}</Link>
              <span className={`shrink-0 font-mono text-xs font-semibold ${isOpen ? 'text-signal' : 'text-graphite'}`}>{isOpen ? `可审查 ${call.remainingReviews} 份` : call.mode}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">{call.title}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-graphite">{call.criteria}</p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-rail pt-4">
              <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-graphite">{owner ? <MemberAvatar member={owner} size="size-6" /> : null}<span className="truncate">{owner?.name ?? call.ownerHandle} · {call.applications} 份申请</span></span>
              <Link to={`/explore/projects/${call.projectID}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">查看要求<ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </article>
        )
      }) : <EmptyState />}
    </section>
  )
}

function ExecutionNetwork() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />执行网络</div>
      <h2 className="font-display text-2xl font-semibold text-ink">已锁定成果形成的连接</h2>
      <p className="max-w-3xl text-sm leading-6 text-graphite">人、项目和成果的关系只在被锁定或正式采纳后出现。点击节点可聚焦其关系说明。</p>
      <PublicNetworkGraph />
    </section>
  )
}

function MemberAvatar({ member, size }: { member: PublicMember; size: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full font-mono text-xs font-semibold text-white ${member.color} ${size}`}>{memberInitials(member)}</span>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="min-w-0 text-center first:text-left last:text-right"><span className="block font-mono text-[11px] font-semibold text-graphite">{label}</span><span className="mt-1 block text-sm font-semibold text-ink">{value}</span></span>
}

function EmptyState() {
  return <div className="border-l-2 border-rail py-5 pl-4 text-sm text-graphite">没有匹配的公开记录。</div>
}

function matches(query: string, values: string[]) {
  return !query || values.some((value) => value.toLowerCase().includes(query))
}
