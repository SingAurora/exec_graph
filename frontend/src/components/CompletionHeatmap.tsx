import type { CompletionRecord } from '../types'

type CompletionHeatmapProps = {
  records: CompletionRecord[]
}

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const intensityClasses = [
  'bg-rail/45',
  'bg-signal/20',
  'bg-signal/45',
  'bg-signal/70',
  'bg-moss',
]

function completionDate(record: CompletionRecord) {
  return new Date(record.createdAt)
}

function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function intensityClass(count: number, highestCount: number) {
  if (count === 0) return intensityClasses[0]
  if (highestCount === 1) return intensityClasses[4]

  const level = Math.ceil((count / highestCount) * 4)
  return intensityClasses[Math.min(Math.max(level, 1), 4)]
}

export function CompletionHeatmap({ records }: CompletionHeatmapProps) {
  const latestCompletion = records
    .map(completionDate)
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0]
  const anchor = latestCompletion ?? new Date()
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const completionCounts = new Map<string, number>()

  records.forEach((record) => {
    const date = completionDate(record)
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month) {
      const key = dayKey(date)
      completionCounts.set(key, (completionCounts.get(key) ?? 0) + 1)
    }
  })

  const highestCount = Math.max(...completionCounts.values(), 0)
  const leadingDays = Array.from({ length: firstWeekday })
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1)
    const count = completionCounts.get(dayKey(date)) ?? 0

    return { date, count }
  })

  return (
    <section className="border-y border-rail py-5 sm:py-6" aria-labelledby="heatmap-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">Monthly trail</div>
          <h2 id="heatmap-title" className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
            {year} 年 {month + 1} 月
          </h2>
        </div>
        <div className="text-sm font-semibold text-graphite">{records.length} 条阶段完成记录</div>
      </div>

      <div className="mt-5 flex min-w-0 gap-3 sm:gap-4">
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-px font-mono text-[10px] font-medium leading-6 text-graphite" aria-hidden="true">
          {weekdays.map((weekday) => (
            <span key={weekday} className="grid size-6 place-items-center">
              {weekday}
            </span>
          ))}
        </div>
        <div className="grid shrink-0 grid-flow-col grid-rows-7 gap-1 [grid-auto-columns:1.5rem] sm:[grid-auto-columns:1.8rem]">
          {leadingDays.map((_, index) => (
            <span key={`leading-${index}`} className="aspect-square w-full" aria-hidden="true" />
          ))}
          {days.map(({ date, count }) => (
            <span
              key={dayKey(date)}
              title={`${date.toLocaleDateString('zh-CN')}：${count} 条阶段完成记录`}
              aria-label={`${date.toLocaleDateString('zh-CN')}，${count} 条阶段完成记录`}
              className={`aspect-square w-full rounded-sm ${intensityClass(count, highestCount)}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-medium text-graphite" aria-label="热力强度：少到多">
        <span>少</span>
        {intensityClasses.map((className) => (
          <span key={className} className={`size-3 rounded-sm ${className}`} aria-hidden="true" />
        ))}
        <span>多</span>
      </div>
    </section>
  )
}
