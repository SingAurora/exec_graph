import { useId } from 'react'
import { Switch } from 'radix-ui'
import { ActionGraphLegend } from '../../../entities/action/ui/ActionGraphLegend'
import { GraphBackground } from '../../../shared/ui/graph-background/GraphBackground'
import type { GraphBackgroundPreferences } from '../../../shared/ui/graph-background/model'

/** Uses the real canvas background and legend to preview branching action references. */
export function GraphAppearancePreview({ preferences, showLegend, onShowLegendChange }: { preferences: GraphBackgroundPreferences; showLegend: boolean; onShowLegendChange: (show: boolean) => void }) {
  const id = useId()
  return (
    <figure className="min-w-0 self-start" aria-label="节点图外观预览">
      <figcaption className="mb-3 text-xs leading-5 text-muted">实时预览</figcaption>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="relative h-60 overflow-hidden" aria-label="背景预览">
          <GraphBackground preferences={preferences} />
          <svg className="relative size-full" viewBox="0 0 300 240" aria-hidden="true">
            <defs><marker id={`${id}-arrow`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="var(--graph-blue)" /></marker></defs>
            <path d="M100 56 V102 M100 134 V180" fill="none" stroke="var(--graph-blue)" strokeWidth="1.6" markerEnd={`url(#${id}-arrow)`} />
            <path d="M112 52 C112 80 210 70 210 102" fill="none" stroke="var(--graph-blue)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd={`url(#${id}-arrow)`} />
            <text x="174" y="80" textAnchor="middle" dominantBaseline="central" fill="var(--coral)" stroke="var(--surface)" strokeWidth="4" paintOrder="stroke" fontSize="18">×</text>
            {[{ x: 100, y: 40, level: 1 }, { x: 100, y: 118, level: 2 }, { x: 210, y: 118, level: 2 }, { x: 100, y: 196, level: 3 }].map(({ x, y, level }) => <g key={`${x}-${y}`}>
              {level === 3 && <circle cx={x} cy={y} r="22" fill="var(--signal)" opacity="0.1" />}
              <circle cx={x} cy={y} r="16" fill={level === 3 ? 'var(--signal-soft)' : 'var(--surface)'} stroke={level === 3 ? 'var(--signal)' : 'var(--graph-blue)'} strokeWidth={level === 3 ? '2' : '1.5'} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={level === 3 ? 'var(--signal)' : 'var(--muted)'} fontSize="11" fontWeight="600">{level}</text>
            </g>)}
          </svg>
        </div>
        {showLegend && <div className="border-t border-line px-3 py-3"><ActionGraphLegend /></div>}
      </div>
      <div className="mt-4 flex min-h-8 items-center justify-between gap-4">
        <label className="cursor-pointer text-sm" htmlFor={id}>显示图例</label>
        <Switch.Root id={id} checked={showLegend} onCheckedChange={onShowLegendChange} className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 bg-line p-0.5 outline-none transition-colors data-[state=checked]:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"><Switch.Thumb className="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" /></Switch.Root>
      </div>
    </figure>
  )
}
