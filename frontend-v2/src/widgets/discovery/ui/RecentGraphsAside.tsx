import type { GraphActivity } from '../../../entities/project/model/types'
import { ProjectAvatar } from '../../../entities/project/ui/ProjectAvatar'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'

/** Small graph directory ordered by real activity, without duplicating the main content feed. */
export function RecentGraphsAside({ items, onOpen }: { items: GraphActivity[]; onOpen: (id: string) => void }) {
  return <aside className="min-w-0 rounded-lg bg-soft p-4" aria-labelledby="discovery-recent-graphs">
    <h2 className="text-sm font-semibold leading-6" id="discovery-recent-graphs">近期活跃的图</h2>
    {items.length ? <div className="mt-4 grid gap-5">
      {items.slice(0, 3).map(({ project, participantCount, lastActionAt }) => <button className="group flex min-w-0 items-start gap-2.5 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" key={project.id} onClick={() => onOpen(project.id)}>
        <ProjectAvatar project={project} size="compact" />
        <span className="grid min-w-0 flex-1 gap-1">
          <strong className="line-clamp-2 text-[13px] font-medium leading-5 group-hover:text-signal">{project.title}</strong>
          <span className="text-xs leading-5 text-muted">{participantCount} 人参与</span>
          {lastActionAt && <time className="text-[11px] leading-5 text-muted" dateTime={lastActionAt} title={formatFullPublicationTime(lastActionAt)}>最近行动 {formatPublicationTime(lastActionAt)}</time>}
        </span>
      </button>)}
    </div> : <p className="py-5 text-center text-sm text-muted" role="status">暂无活跃的图</p>}
  </aside>
}
