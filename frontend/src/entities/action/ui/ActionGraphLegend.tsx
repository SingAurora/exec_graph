import { Check } from 'lucide-react'

/** Shared authorship, agreement and depth legend for canvases and appearance previews. */
export function ActionGraphLegend({ compact = false }: { compact?: boolean } = {}) {
  const itemClass = `inline-flex items-center whitespace-nowrap ${compact ? 'gap-1' : 'gap-1.5'}`
  const lineClass = compact ? 'w-3' : 'w-4'
  const markerClass = compact ? 'size-3.5' : 'size-4'
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-x-2 text-[10px]' : 'gap-x-3 text-[11px]'} gap-y-1.5 leading-4 text-muted`}>
      <span className={itemClass}><i className={`${lineClass} border-t-2 border-muted`} />行动接续</span>
      <span className={itemClass}><i className={`${lineClass} border-t-2 border-dashed border-muted`} />引用其他</span>
      <span className={itemClass}><b className={`inline-grid ${markerClass} place-items-center text-signal`}><Check size={compact ? 10 : 12} strokeWidth={3}/></b>满足约定</span>
      <span className={itemClass}><b className={`inline-grid ${markerClass} place-items-center rounded-full border border-muted text-[9px] font-medium leading-none`}>2</b>节点层级</span>
    </div>
  )
}
