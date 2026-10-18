import { useId } from 'react'
import { GraphBackground } from '../../../shared/ui/graph-background/GraphBackground'
import { createDefaultGraphBackground, type GraphBackgroundPreferences, type GraphBackgroundStyle, type GraphPatternIntensity } from '../../../shared/ui/graph-background/model'

const styles: { value: GraphBackgroundStyle; label: string }[] = [
  { value: 'plain', label: '纯色' }, { value: 'dots', label: '点阵' },
  { value: 'grid', label: '细线网格' }, { value: 'crosses', label: '十字网格' },
]
const intensities: { value: GraphPatternIntensity; label: string }[] = [
  { value: 'light', label: '浅' }, { value: 'standard', label: '标准' }, { value: 'strong', label: '明显' },
]

/** Edits global canvas preferences with conditional controls and a shared live preview. */
export function GraphBackgroundSettings({ preferences, onChange }: { preferences: GraphBackgroundPreferences; onChange: (preferences: GraphBackgroundPreferences) => void }) {
  const id = useId()
  const pattern = preferences.style === 'plain' ? undefined : preferences[preferences.style]
  const updateCommon = (patch: { spacing?: number; intensity?: GraphPatternIntensity }) => {
    if (preferences.style !== 'plain') onChange({ ...preferences, [preferences.style]: { ...preferences[preferences.style], ...patch } })
  }
  return <div className="mt-5 grid gap-5" aria-label="节点图背景设置">
    <fieldset>
      <legend className="mb-3 text-[13px] font-medium">背景样式</legend>
      <div className="grid grid-cols-4 gap-3">
        {styles.map(({ value, label }) => <label className="min-w-0 cursor-pointer" key={value}>
          <input className="peer sr-only" type="radio" name={`${id}-style`} value={value} checked={preferences.style === value} onChange={() => onChange({ ...preferences, style: value })} />
          <span className="block overflow-hidden rounded-md border border-line bg-surface transition hover:border-signal/50 peer-checked:border-signal peer-checked:ring-1 peer-checked:ring-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal">
            <span className="relative block h-16"><GraphBackground preferences={{ ...preferences, style: value }} /></span>
          </span>
          <span className={`mt-2 block text-center text-xs ${preferences.style === value ? 'font-semibold text-signal' : 'text-muted'}`}>{label}</span>
        </label>)}
      </div>
    </fieldset>
    {pattern && <>
      {preferences.style === 'dots' && <RangeControl label="圆点大小" value={preferences.dots.size} min={1} max={3} step={0.5} onChange={(size) => onChange({ ...preferences, dots: { ...preferences.dots, size } })} />}
      {preferences.style === 'crosses' && <RangeControl label="十字大小" value={preferences.crosses.size} min={4} max={8} onChange={(size) => onChange({ ...preferences, crosses: { ...preferences.crosses, size } })} />}
      {preferences.style === 'grid' && <RangeControl label="线条粗细" value={preferences.grid.lineWidth} min={0.5} max={1.5} step={0.5} onChange={(lineWidth) => onChange({ ...preferences, grid: { ...preferences.grid, lineWidth } })} />}
      {preferences.style === 'crosses' && <RangeControl label="线条粗细" value={preferences.crosses.lineWidth} min={0.5} max={1.5} step={0.5} onChange={(lineWidth) => onChange({ ...preferences, crosses: { ...preferences.crosses, lineWidth } })} />}
      <RangeControl label="纹理间距" value={pattern.spacing} min={16} max={40} onChange={(spacing) => updateCommon({ spacing })} />
      <fieldset className="flex flex-wrap items-center justify-between gap-3">
        <legend className="float-left mr-5 text-[13px] font-medium">纹理深浅</legend>
        <div className="flex items-center gap-4">{intensities.map(({ value, label }) => <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px]" key={value}><input className="size-3.5 accent-signal" type="radio" name={`${id}-intensity`} value={value} checked={pattern.intensity === value} onChange={() => updateCommon({ intensity: value })} />{label}</label>)}</div>
      </fieldset>
    </>}
    <figure>
      <figcaption className="mb-2 text-xs text-muted">预览</figcaption>
      <div className="relative h-44 overflow-hidden rounded-md border border-line bg-surface" aria-label={`${styles.find((style) => style.value === preferences.style)?.label}背景预览`}>
        <GraphBackground preferences={preferences} />
        <svg className="relative size-full" viewBox="0 0 400 176" aria-hidden="true">
          <path d="M110 128 C110 86 210 90 210 48" fill="none" stroke="var(--signal)" strokeWidth="2" />
          <path d="M110 128 C110 85 300 96 300 48" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" />
          {[{ x: 110, y: 128, label: 1 }, { x: 210, y: 48, label: 2 }, { x: 300, y: 48, label: 2 }].map(({ x, y, label }) => <g key={x}><circle cx={x} cy={y} r="14" fill="var(--surface)" stroke={x === 300 ? 'var(--muted)' : 'var(--signal)'} strokeWidth="1.5" /><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--ink)" fontSize="12">{label}</text></g>)}
        </svg>
      </div>
    </figure>
    <button className="text-button justify-self-start" type="button" onClick={() => onChange(createDefaultGraphBackground())}>恢复默认</button>
  </div>
}

function RangeControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const id = useId()
  return <div><div className="mb-2 flex items-center justify-between gap-3 text-[13px]"><label className="font-medium" htmlFor={id}>{label}</label><output className="tabular-nums text-muted" htmlFor={id}>{value}px</output></div><input className="block h-5 w-full cursor-pointer accent-signal" id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} 像素`} onChange={(event) => onChange(Number(event.target.value))} /></div>
}
