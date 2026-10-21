import { useId } from 'react'
import { RotateCcw } from 'lucide-react'
import { GraphBackground } from '../../../shared/ui/graph-background/GraphBackground'
import { createDefaultGraphBackground, type GraphBackgroundPreferences, type GraphBackgroundStyle, type GraphPatternIntensity } from '../../../shared/ui/graph-background/model'
import { GraphAppearancePreview } from './GraphAppearancePreview'

const styles: { value: GraphBackgroundStyle; label: string }[] = [
  { value: 'plain', label: '纯色' }, { value: 'dots', label: '点阵' },
  { value: 'grid', label: '细线网格' }, { value: 'crosses', label: '十字网格' },
]
const intensities: { value: GraphPatternIntensity; label: string }[] = [
  { value: 'light', label: '浅' }, { value: 'standard', label: '标准' }, { value: 'strong', label: '明显' },
]

/** Edits global canvas preferences with conditional controls and a shared live preview. */
export function GraphBackgroundSettings({ preferences, onChange, showLegend, onShowLegendChange }: { preferences: GraphBackgroundPreferences; onChange: (preferences: GraphBackgroundPreferences) => void; showLegend: boolean; onShowLegendChange: (show: boolean) => void }) {
  const id = useId()
  const pattern = preferences.style === 'plain' ? undefined : preferences[preferences.style]
  const isDefault = JSON.stringify(preferences) === JSON.stringify(createDefaultGraphBackground())
  const updateCommon = (patch: { spacing?: number; intensity?: GraphPatternIntensity }) => {
    if (preferences.style !== 'plain') onChange({ ...preferences, [preferences.style]: { ...preferences[preferences.style], ...patch } })
  }
  return <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-8 max-[1000px]:grid-cols-1" aria-label="节点图背景设置">
    <div className="grid min-w-0 gap-5">
    <fieldset>
      <legend className="sr-only">背景样式</legend>
      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-medium" aria-hidden="true">背景样式</span><button className="inline-flex min-h-5 items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-muted hover:text-signal disabled:hover:text-muted" type="button" disabled={isDefault} onClick={() => onChange(createDefaultGraphBackground())} aria-label="恢复节点图背景默认设置"><RotateCcw size={12} aria-hidden="true" />恢复默认</button></div>
      <div className="grid grid-cols-4 gap-2">
        {styles.map(({ value, label }) => <label className="min-w-0 cursor-pointer" key={value}>
          <input className="peer sr-only" type="radio" name={`${id}-style`} value={value} checked={preferences.style === value} onChange={() => onChange({ ...preferences, style: value })} />
          <span className="block overflow-hidden rounded-md border border-line bg-surface transition hover:border-signal/50 peer-checked:border-signal peer-checked:ring-1 peer-checked:ring-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal">
            <span className="relative block h-14"><GraphBackground preferences={{ ...preferences, style: value }} /></span>
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
      <fieldset>
        <legend className="mb-3 text-sm font-medium">纹理深浅</legend>
        <div className="grid grid-cols-3 gap-2">{intensities.map(({ value, label }) => <label className="min-w-0 cursor-pointer" key={value}><input className="peer sr-only" type="radio" name={`${id}-intensity`} value={value} checked={pattern.intensity === value} onChange={() => updateCommon({ intensity: value })} /><span className="flex h-9 items-center justify-center rounded-md border border-line text-sm text-muted hover:border-signal/50 peer-checked:border-signal peer-checked:bg-signal-soft peer-checked:font-medium peer-checked:text-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">{label}</span></label>)}</div>
      </fieldset>
    </>}
    </div>
    <GraphAppearancePreview preferences={preferences} showLegend={showLegend} onShowLegendChange={onShowLegendChange} />
  </div>
}

function RangeControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const id = useId()
  return <div><div className="mb-2 flex items-center justify-between gap-3 text-sm"><label className="font-medium" htmlFor={id}>{label}</label><output className="text-xs tabular-nums text-muted" htmlFor={id}>{value} px</output></div><input className="block h-5 w-full cursor-pointer accent-signal" id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} 像素`} onChange={(event) => onChange(Number(event.target.value))} /></div>
}
