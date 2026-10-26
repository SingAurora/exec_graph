import { Footprints } from 'lucide-react'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { getMarkdownSummary } from '../../shared/lib/markdownSummary'

/** Published action log with a connected marker and publication time below the title. */
export function ProfileTimelineItem({ node, last = false, onOpenNode }: {
  node: ActionNode; last?: boolean; onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const summary = getMarkdownSummary(node.objectiveMarkdown ?? node.markdown, node.title)
  return (
    <article className="relative min-w-0 pb-7 pl-10 last:pb-1" data-timeline-node={node.id}>
      {!last && <span className="absolute bottom-0 left-[11px] top-6 w-px bg-line" />}
      <span className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full bg-soft text-signal"><Footprints size={13} strokeWidth={1.8} /></span>
      <button className="group block w-full min-w-0 rounded-sm border-0 bg-transparent p-0 text-left text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" onClick={() => onOpenNode(node, 'objective')} title={'查看行动：' + node.title}>
        <span className="block font-medium group-hover:text-signal">{node.title}</span>
        {summary && <span className="mt-1 line-clamp-2 break-words font-normal text-muted">{summary}</span>}
      </button>
      <time className="mt-1 block text-xs leading-5 tabular-nums text-muted" dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
    </article>
  )
}
