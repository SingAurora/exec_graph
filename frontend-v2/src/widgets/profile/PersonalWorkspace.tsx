import { ArrowRight } from 'lucide-react'
import { hasUserContributed } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../entities/action/lib/expressions'
import { ProjectAvatar } from '../../entities/project/ui/ProjectAvatar'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import type { CreateProjectInput } from '../../features/project/model/types'
import { CreateGraphButton } from '../../features/project/ui/CreateGraphButton'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { DashboardDocumentCard } from './DashboardDocumentCard'

const recentItemLimit = 3

/** Personal dashboard with recent document previews and a separate graph shortcut rail. */
export function PersonalWorkspace({ profile, projects, actions, onCreateProject, onOpenProject, onOpenNode }: {
  profile: UserProfile; projects: Project[]; actions: ActionNode[]
  onCreateProject: (input: CreateProjectInput) => void; onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const ownActions = sortActionsNewestFirst(actions.filter((node) => node.authorId === profile.id))
  const expressions = getPublishedExpressions(actions, [profile.id])
  const related = projects.filter((project) => project.ownerId === profile.id || hasUserContributed(project.id, profile.id, actions))
  const ownedCount = projects.filter((project) => project.ownerId === profile.id).length
  const joinedCount = related.filter((project) => project.ownerId !== profile.id).length
  const graphs = related.map((project) => ({ project, lastOwnActionAt: ownActions.find((node) => node.projectId === project.id)?.createdAt }))
    .sort((a, b) => Date.parse(b.lastOwnActionAt ?? b.project.createdAt) - Date.parse(a.lastOwnActionAt ?? a.project.createdAt))
  const profileHref = '#profile?userId=' + encodeURIComponent(profile.id)
  const stats = [
    { value: ownActions.length, label: '行动' },
    { value: expressions.length, label: '表达' },
    { value: ownedCount, label: '发起的图' },
    { value: joinedCount, label: '参与的图' },
  ]
  const sections = [
    { id: 'expressions', title: '最近表达', mode: 'expression' as const, nodes: expressions.slice(0, recentItemLimit), empty: '还没有表达' },
    { id: 'actions', title: '最近行动', mode: 'objective' as const, nodes: ownActions.slice(0, recentItemLimit), empty: '还没有行动记录' },
  ]
  return <section className="pt-7" aria-label="个人总览">
    <dl className="grid grid-cols-4 rounded-lg bg-soft px-2 py-5" aria-label="个人数据">
      {stats.map(({ value, label }) => <div className="flex flex-col gap-1.5 px-5" key={label}>
        <dt className="text-xs text-muted">{label}</dt><dd className="order-first text-[28px] font-semibold leading-9 tabular-nums tracking-tight text-ink">{value}</dd>
      </div>)}
    </dl>
    <div className="mt-8 grid grid-cols-[minmax(0,1fr)_252px] items-start gap-7 max-[1000px]:grid-cols-[minmax(0,1fr)_220px] max-[1000px]:gap-5">
      <div className="grid min-w-0 gap-8">
        {sections.map(({ id, title, mode, nodes, empty }) => <section className="min-w-0" key={id} aria-labelledby={'recent-' + id + '-title'}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id={'recent-' + id + '-title'} className="text-lg font-semibold tracking-tight">{title}</h2><a href={profileHref + '&tab=' + id} className="text-button">查看全部<ArrowRight size={14} /></a></div>
          {nodes.length ? <div className="grid gap-3">{nodes.map((node) => <DashboardDocumentCard key={node.id} node={node} actions={actions} project={projects.find((project) => project.id === node.projectId)} mode={mode} onOpenNode={onOpenNode} onOpenProject={onOpenProject} />)}</div>
            : <div className="rounded-lg border border-line bg-surface px-5 py-10 text-center text-sm text-muted" role="status">{empty}</div>}
        </section>)}
      </div>
      <aside className="min-w-0" aria-labelledby="recent-graphs-title">
        <h2 id="recent-graphs-title" className="mb-4 text-lg font-semibold tracking-tight">最近的图</h2>
        <div className="rounded-lg bg-soft p-4">
          {graphs.length ? <div className="grid gap-5">
            {graphs.slice(0, recentItemLimit).map(({ project, lastOwnActionAt }) => <button className="group grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 border-0 bg-transparent p-0 text-left" type="button" onClick={() => onOpenProject(project.id)} key={project.id}>
              <ProjectAvatar project={project} size="compact" /><span className="grid min-w-0 gap-1"><strong className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-signal">{project.title}</strong><span className="text-[11px] leading-4 text-signal">{project.ownerId === profile.id ? '我发起的' : '我参与的'}</span></span>
              {project.description && <span className="col-span-full line-clamp-2 text-xs leading-5 text-copy">{project.description}</span>}
              <time className="col-span-full text-[11px] leading-5 text-muted" dateTime={lastOwnActionAt ?? project.createdAt} title={formatFullPublicationTime(lastOwnActionAt ?? project.createdAt)}>{lastOwnActionAt ? '最近参与 ' : '创建于 '}{formatPublicationTime(lastOwnActionAt ?? project.createdAt)}</time>
            </button>)}
          </div> : <p className="py-4 text-center text-sm leading-6 text-muted" role="status">还没有参与或发起的行动图</p>}
          <div className="mt-5 flex justify-between border-t border-line pt-4"><a className="text-button" href="#projects">全部行动图<ArrowRight size={14} /></a></div>
        </div>
        <div className="mt-4 flex justify-end"><CreateGraphButton onCreate={onCreateProject} /></div>
      </aside>
    </div>
  </section>
}
