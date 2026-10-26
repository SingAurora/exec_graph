import { useRef, useState, type KeyboardEvent } from 'react'
import type { ProfileActivityDay } from '../../entities/action/lib/profile-activity'
import './profile-home.css'

const intensity = (count: number) => Math.min(count, 4)

/** A rolling year of published actions; choosing a day filters the retained timeline. */
export function ActionHeatmap({ days, selectedDate, onSelectDate }: {
  days: ProfileActivityDay[]; selectedDate?: string; onSelectDate: (date: string) => void
}) {
  const [focusedIndex, setFocusedIndex] = useState(days.length - 1)
  const cellsRef = useRef<HTMLDivElement>(null)
  const first = new Date(days[0].date + 'T00:00:00')
  const offset = (first.getDay() + 6) % 7
  const columns = Math.ceil((days.length + offset) / 7)
  const months = days.flatMap((day, index) => day.date.endsWith('-01')
    ? [{ label: Number(day.date.slice(5, 7)) + '月', column: Math.floor((index + offset) / 7) + 1 }] : [])
  const total = days.reduce((count, day) => count + day.count, 0)
  const activeDays = days.filter((day) => day.count > 0).length
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const movement: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1 : movement[event.key] !== undefined ? index + movement[event.key] : undefined
    if (next === undefined) return
    event.preventDefault()
    const target = Math.max(0, Math.min(days.length - 1, next))
    setFocusedIndex(target)
    cellsRef.current?.querySelector<HTMLButtonElement>(`[data-day-index="${target}"]`)?.focus({ preventScroll: true })
  }
  return (
    <section className="py-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">过去一年 <span className="ml-1 font-semibold tabular-nums text-signal">{total}</span> 次行动</h3>
        <span className="text-xs text-muted">{activeDays} 天有行动</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div className="mb-2 ml-7 grid gap-[3px] text-[11px] leading-4 text-muted" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {months.map((month, index) => <span className="whitespace-nowrap" style={{ gridColumn: `${month.column} / span ${Math.min(3, columns - month.column + 1)}`, gridRow: 1 }} key={index}>{month.label}</span>)}
          </div>
          <div className="flex gap-2">
            <div className="grid w-5 shrink-0 grid-rows-7 items-center text-[10px] leading-none text-muted"><span /><span>二</span><span /><span>四</span><span /><span>六</span><span /></div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]" ref={cellsRef} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
              {days.map((day, index) => <button key={day.date} type="button" className="profile-heatmap-day" data-level={intensity(day.count)} data-day-index={index}
                title={`${day.date} · ${day.count} 次行动`} data-selected={selectedDate === day.date}
                tabIndex={focusedIndex === index ? 0 : -1} onFocus={() => setFocusedIndex(index)} onKeyDown={(event) => moveFocus(event, index)} onClick={() => onSelectDate(day.date)} />)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
        <span>{days[0].date.replaceAll('-', '.')} — {days.at(-1)!.date.replaceAll('-', '.')}</span>
        <div className="flex items-center gap-1.5"><span>少</span>{[0, 1, 2, 3, 4].map((level) => <span className="profile-heatmap-key size-2.5" data-level={level} key={level} />)}<span>多</span></div>
      </div>
    </section>
  )
}
