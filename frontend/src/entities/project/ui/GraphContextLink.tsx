import { Network } from 'lucide-react'

/** Opens the graph associated with a feed item using a consistent secondary link. */
export function GraphContextLink({ id, title, onOpen }: { id: string; title?: string; onOpen: (id: string) => void }) {
  return (
    <button className="inline-flex max-w-full items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-left text-xs leading-5 text-muted hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" onClick={() => onOpen(id)}>
      <Network size={13} className="shrink-0" /><span className="line-clamp-1">{title ?? '行动图'}</span>
    </button>
  )
}
