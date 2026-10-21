import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { hasUserContributed } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../entities/action/lib/expressions'
import { getProfileAgreementResponses } from '../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../entities/action/lib/references'
import { ProjectAvatar } from '../../entities/project/ui/ProjectAvatar'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import type { CreateProjectInput } from '../../features/project/model/types'
import { CreateGraphButton } from '../../features/project/ui/CreateGraphButton'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { DashboardDocumentCard } from './DashboardDocumentCard'
import { DashboardAgreementCard } from './DashboardAgreementCard'

const recentItemLimit = 3

/** Finite previews of personal actions and expressions, with agreement exchanges and graph shortcuts. */
export function PersonalWorkspace({ profile, users, projects, actions, onCreateProject, onOpenProject, onOpenNode, onOpenReference }: {
  profile: UserProfile; users: UserProfile[]; projects: Project[]; actions: ActionNode[]
  onCreateProject: (input: CreateProjectInput) => void; onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
}) {
  const ownActions = sortActionsNewestFirst(actions.filter((node) => node.authorId === profile.id))
  const expressions = getPublishedExpressions(actions, [profile.id])
  const related = projects.filter((project) => project.ownerId === profile.id || hasUserContributed(project.id, profile.id, actions))
  const agreements = useMemo(() => getProfileAgreementResponses(getActionReferences(actions), profile.id), [actions, profile.id])
  const graphs = related.map((project) => ({ project, lastOwnActionAt: ownActions.find((node) => node.projectId === project.id)?.createdAt }))
    .sort((a, b) => Date.parse(b.lastOwnActionAt ?? b.project.createdAt) - Date.parse(a.lastOwnActionAt ?? a.project.createdAt))
  const profileHref = '#profile?userId=' + encodeURIComponent(profile.id)
  const stats = [
    { value: ownActions.length, label: '行动', href: profileHref + '&tab=actions' },
    { value: expressions.length, label: '表达', href: profileHref + '&tab=expressions' },
    { value: agreements.length, label: '约定', href: profileHref + '&tab=agreements' },
    { value: related.length, label: '图', href: '#projects' },
  ]
  const sections = [
    { id: 'actions', title: '最近行动', mode: 'objective' as const, nodes: ownActions.slice(0, recentItemLimit), empty: '还没有行动记录' },
    { id: 'expressions', title: '最近表达', mode: 'expression' as const, nodes: expressions.slice(0, recentItemLimit), empty: '还没有表达' },
  ]
  return <section className="pt-7" aria-label="个人总览">
    <nav className="grid grid-cols-4 rounded-lg bg-soft px-5 py-3" aria-label="个人数据">
      {stats.map(({ value, label, href }) => <a className="group inline-flex min-h-10 min-w-0 flex-wrap items-baseline content-center gap-x-2 rounded-md text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={href} aria-label={`查看全部${label}，共 ${value} ${label === '图' ? '个' : '条'}`} key={label}>
        <strong className="text-2xl font-semibold leading-8 tabular-nums tracking-tight">{value}</strong><span className="text-xs text-muted group-hover:text-signal">{label}</span>
      </a>)}
    </nav>
    <div className="mt-7 grid grid-cols-[minmax(0,1fr)_252px] items-start gap-6 max-[1000px]:grid-cols-[minmax(0,1fr)_220px] max-[1000px]:gap-5">
      <div className="grid min-w-0 gap-7">
        {sections.map(({ id, title, mode, nodes, empty }) => <section className="min-w-0" key={id} aria-labelledby={'recent-' + id + '-title'}>
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id={'recent-' + id + '-title'} className="text-base font-semibold tracking-tight">{title}</h2><a href={profileHref + '&tab=' + id} className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal">查看全部<ArrowRight size={13} /></a></div>
          {nodes.length ? <div className={`grid rounded-lg bg-surface p-4 ${mode === 'objective' ? 'gap-5' : ''}`}>{nodes.map((node, index) => <DashboardDocumentCard key={node.id} node={node} actions={actions} users={users} project={projects.find((project) => project.id === node.projectId)} mode={mode} compact={mode === 'objective' && index > 0} onOpenNode={onOpenNode} onOpenProject={onOpenProject} />)}</div>
            : <p className="rounded-lg bg-surface px-4 py-10 text-center text-sm text-muted" role="status">{empty}</p>}
        </section>)}
        <section className="min-w-0" aria-labelledby="recent-agreements-title">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="recent-agreements-title" className="text-base font-semibold tracking-tight">最近约定</h2><a href={profileHref + '&tab=agreements'} className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal" aria-label="查看全部约定">查看全部<ArrowRight size={13} /></a></div>
          {agreements.length ? <div className="grid rounded-lg bg-surface p-4">{agreements.slice(0, recentItemLimit).map((reference) => <DashboardAgreementCard key={reference.id} reference={reference} users={users} project={projects.find((project) => project.id === reference.target.projectId)} onOpenReference={onOpenReference} onOpenProject={onOpenProject} />)}</div>
            : <p className="rounded-lg bg-surface px-4 py-10 text-center text-sm text-muted" role="status">暂无约定交流</p>}
        </section>
      </div>
      <aside className="grid min-w-0 gap-5" aria-label="图入口">
        <section className="min-w-0 rounded-lg bg-soft p-4" aria-labelledby="recent-graphs-title">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 id="recent-graphs-title" className="text-base font-semibold tracking-tight">最近的图</h2><CreateGraphButton onCreate={onCreateProject} compact /></div>
          {graphs.length ? <div className="grid gap-4">
            {graphs.slice(0, recentItemLimit).map(({ project, lastOwnActionAt }) => <button className="group flex min-w-0 items-start gap-2.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" onClick={() => onOpenProject(project.id)} key={project.id}>
              <ProjectAvatar project={project} size="compact" /><span className="grid min-w-0 gap-1"><strong className="line-clamp-2 text-[13px] font-medium leading-5 group-hover:text-signal">{project.title}</strong>
                <time className="text-[11px] leading-5 text-muted" dateTime={lastOwnActionAt ?? project.createdAt} title={formatFullPublicationTime(lastOwnActionAt ?? project.createdAt)}>{lastOwnActionAt ? '最近参与 ' : '创建于 '}{formatPublicationTime(lastOwnActionAt ?? project.createdAt)}</time>
              </span>
            </button>)}
          </div> : <p className="py-4 text-center text-sm leading-6 text-muted" role="status">还没有参与或发起的行动图</p>}
          <div className="mt-4 flex justify-end"><a className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal" href="#projects">全部行动图<ArrowRight size={13} /></a></div>
        </section>
      </aside>
    </div>
  </section>
}
