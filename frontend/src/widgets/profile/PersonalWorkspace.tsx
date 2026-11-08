import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { hasUserContributed } from '../../entities/graph/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { sortActionsNewestFirst } from '../../entities/action/lib/expressions'
import { getProfileAgreementResponses } from '../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../entities/action/lib/references'
import { GraphAvatar } from '../../entities/graph/ui/GraphAvatar'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Graph } from '../../entities/graph/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import type { CreateGraphInput } from '../../features/graph/model/types'
import { CreateGraphButton } from '../../features/graph/ui/CreateGraphButton'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { DashboardDocumentCard } from './DashboardDocumentCard'
import { DashboardAgreementCard } from './DashboardAgreementCard'

const recentItemLimit = 3

/** Finite previews of personal actions and expressions, with agreement exchanges and graph shortcuts. */
export function PersonalWorkspace({ profile, users, graphs, actions, onCreateGraph, onOpenGraph, onOpenNode, onOpenReference }: {
  profile: UserProfile; users: UserProfile[]; graphs: Graph[]; actions: ActionNode[]
  onCreateGraph: (input: CreateGraphInput) => void | Promise<void>; onOpenGraph: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
}) {
  const ownActions = sortActionsNewestFirst(actions.filter((node) => node.authorUuid === profile.uuid))
  const expressions = getPublishedExpressions(actions, [profile.uuid])
  const related = graphs.filter((graph) => graph.ownerUuid === profile.uuid || hasUserContributed(graph.uuid, profile.uuid, actions))
  const agreements = useMemo(() => getProfileAgreementResponses(getActionReferences(actions), profile.uuid), [actions, profile.uuid])
  const graphActivities = related.map((graph) => ({ graph, lastOwnActionAt: ownActions.find((node) => node.graphUuid === graph.uuid)?.createdAt }))
    .sort((a, b) => Date.parse(b.lastOwnActionAt ?? b.graph.createdAt) - Date.parse(a.lastOwnActionAt ?? a.graph.createdAt))
  const profileHref = '#profile?userUuid=' + encodeURIComponent(profile.uuid)
  const stats = [
    { value: ownActions.length, label: '行动', href: profileHref + '&tab=actions' },
    { value: expressions.length, label: '表达', href: profileHref + '&tab=expressions' },
    { value: agreements.length, label: '约定', href: profileHref + '&tab=agreements' },
    { value: related.length, label: '图', href: '#graphs' },
  ]
  const sections = [
    { id: 'actions', title: '最近行动', mode: 'objective' as const, nodes: ownActions.slice(0, recentItemLimit), empty: '还没有行动记录' },
    { id: 'expressions', title: '最近表达', mode: 'expression' as const, nodes: expressions.slice(0, recentItemLimit), empty: '还没有表达' },
  ]
  return (
    <section className="pt-7">
      <nav className="grid grid-cols-4 rounded-lg bg-soft px-5 py-3">
        {stats.map(({ value, label, href }) => <a className="group inline-flex min-h-10 min-w-0 flex-wrap items-baseline content-center gap-x-2 rounded-md text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={href} title={`查看全部${label}，共 ${value} ${label === '图' ? '个' : '条'}`} key={label}>
          <strong className="text-2xl font-semibold leading-8 tabular-nums tracking-tight">{value}</strong><span className="text-xs text-muted group-hover:text-signal">{label}</span>
        </a>)}
      </nav>
      <div className="mt-7 grid grid-cols-[minmax(0,1fr)_252px] items-start gap-6 max-[1000px]:grid-cols-[minmax(0,1fr)_220px] max-[1000px]:gap-5">
        <div className="grid min-w-0 gap-7">
          {sections.map(({ id, title, mode, nodes, empty }) => <section className="min-w-0" key={id}>
            <div className="mb-3 flex items-center justify-between gap-3"><h2 id={'recent-' + id + '-title'} className="text-base font-semibold tracking-tight">{title}</h2><a href={profileHref + '&tab=' + id} className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal">查看全部<ArrowRight size={13} /></a></div>
            {nodes.length ? <div className={`grid rounded-lg bg-surface p-4 ${mode === 'objective' ? 'gap-5' : ''}`}>{nodes.map((node, index) => <DashboardDocumentCard key={node.uuid} node={node} actions={actions} users={users} graph={graphActivities.find((activity) => activity.graph.uuid === node.graphUuid)?.graph} mode={mode} compact={mode === 'objective' && index > 0} onOpenNode={onOpenNode} onOpenGraph={onOpenGraph} />)}</div>
              : <p className="rounded-lg bg-surface px-4 py-10 text-center text-sm text-muted">{empty}</p>}
          </section>)}
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 id="recent-agreements-title" className="text-base font-semibold tracking-tight">最近约定</h2><a href={profileHref + '&tab=agreements'} className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal" title="查看全部约定">查看全部<ArrowRight size={13} /></a></div>
            {agreements.length ? <div className="grid rounded-lg bg-surface p-4">{agreements.slice(0, recentItemLimit).map((reference) => <DashboardAgreementCard key={reference.uuid} reference={reference} users={users} graph={graphActivities.find((activity) => activity.graph.uuid === reference.target.graphUuid)?.graph} onOpenReference={onOpenReference} onOpenGraph={onOpenGraph} />)}</div>
              : <p className="rounded-lg bg-surface px-4 py-10 text-center text-sm text-muted">暂无约定交流</p>}
          </section>
        </div>
        <aside className="grid min-w-0 gap-5">
          <section className="min-w-0 rounded-lg bg-soft p-4">
            <div className="mb-4 flex items-center justify-between gap-2"><h2 id="recent-graphs-title" className="text-base font-semibold tracking-tight">最近的图</h2><CreateGraphButton onCreate={onCreateGraph} compact /></div>
            {graphActivities.length ? <div className="grid gap-4">
              {graphActivities.slice(0, recentItemLimit).map(({ graph, lastOwnActionAt }) => <button className="group flex min-w-0 items-start gap-2.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" onClick={() => onOpenGraph(graph.uuid)} key={graph.uuid}>
                <GraphAvatar graph={graph} size="compact" /><span className="grid min-w-0 gap-1"><strong className="line-clamp-2 text-[13px] font-medium leading-5 group-hover:text-signal">{graph.title}</strong>
                  <time className="text-[11px] leading-5 text-muted" dateTime={lastOwnActionAt ?? graph.createdAt} title={formatFullPublicationTime(lastOwnActionAt ?? graph.createdAt)}>{lastOwnActionAt ? '最近参与 ' : '创建于 '}{formatPublicationTime(lastOwnActionAt ?? graph.createdAt)}</time>
                </span>
              </button>)}
            </div> : <p className="py-4 text-center text-sm leading-6 text-muted">还没有参与或发起的行动图</p>}
            <div className="mt-4 flex justify-end"><a className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal" href="#graphs">全部行动图<ArrowRight size={13} /></a></div>
          </section>
        </aside>
      </div>
    </section>
  )
}
