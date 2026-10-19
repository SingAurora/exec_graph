import { ArrowUpRight, Network } from 'lucide-react'
import type { GraphActivity } from '../../entities/project/model/types'
import { ProjectAvatar } from '../../entities/project/ui/ProjectAvatar'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'

/** Compact graph identities and activity totals shared by directories and profiles. */
export function GraphList({ items, onOpen, empty = '暂无行动图' }: { items: GraphActivity[]; onOpen: (id: string) => void; empty?: string }) {
  if (!items.length) return <div className="empty-state" role="status"><Network size={24} strokeWidth={1.5} /><p>{empty}</p></div>
  return <div className="divide-y divide-line" aria-label="行动图列表">
    {items.map(({ project, participantCount, actionCount, expressionCount, lastActionAt }) => <button key={project.id} type="button" onClick={() => onOpen(project.id)} className="group flex w-full items-start gap-3.5 rounded-md border-0 bg-transparent px-2 py-5 text-left hover:bg-soft">
      <ProjectAvatar project={project} />
      <span className="grid min-w-0 flex-1 gap-1.5">
        <strong className="text-base font-semibold leading-6 group-hover:text-signal">{project.title}</strong>
        {project.description && <span className="line-clamp-2 text-sm leading-6 text-copy">{project.description}</span>}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-muted"><span>{participantCount} 人参与</span><span>{actionCount} 条行动</span><span>{expressionCount} 条表达</span>{lastActionAt && <time dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}</span>
      </span>
      <ArrowUpRight size={17} className="mt-1 shrink-0 text-muted group-hover:text-signal" />
    </button>)}
  </div>
}
