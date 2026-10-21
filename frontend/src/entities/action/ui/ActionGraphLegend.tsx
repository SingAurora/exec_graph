/** Shared authorship, agreement and depth legend for canvases and appearance previews. */
export function ActionGraphLegend() {
  const itemClass = 'inline-flex items-center gap-1.5 whitespace-nowrap'
  return <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] leading-4 text-muted" aria-label="节点关系图例">
    <span className={itemClass}><i className="w-4 border-t-2 border-muted" aria-hidden="true" />自己引用</span>
    <span className={itemClass}><i className="w-4 border-t-2 border-dashed border-muted" aria-hidden="true" />引用他人</span>
    <span className={itemClass}><b className="inline-grid size-4 place-items-center text-base font-medium leading-none text-coral" aria-hidden="true">×</b>不满足约定</span>
    <span className={itemClass}><b className="inline-grid size-4 place-items-center rounded-full border border-muted text-[9px] font-medium leading-none" aria-hidden="true">2</b>节点层级</span>
  </div>
}
