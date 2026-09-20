type CompletionHeatmapProps = {
  records: Array<{ createdAt: string }>
}

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const intensityClasses = [
  'bg-rail/45',
  'bg-signal/20',
  'bg-signal/45',
  'bg-signal/70',
  'bg-moss',
]

function completionDate(record: { createdAt: string }) {
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
  const firstDay = new Date(year, 0, 1)
  const lastDay = new Date(year, 11, 31)
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))
  const endDate = new Date(lastDay)
  endDate.setDate(lastDay.getDate() + (6 - ((lastDay.getDay() + 6) % 7)))
  const completionCounts = new Map<string, number>()

  records.forEach((record) => {
    const date = completionDate(record)
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === year) {
      const key = dayKey(date)
      completionCounts.set(key, (completionCounts.get(key) ?? 0) + 1)
    }
  })

  const highestCount = Math.max(...completionCounts.values(), 0)
  const days: Array<{ date: Date; count: number; inYear: boolean }> = []
  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const current = new Date(date)
    const inYear = current.getFullYear() === year
    days.push({ date: current, count: inYear ? completionCounts.get(dayKey(current)) ?? 0 : 0, inYear })
  }
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7))
  const monthMarkers = weeks.map((week) => {
    const monthStart = week.find((day) => day.inYear && day.date.getDate() === 1)

    return monthStart ? monthLabels[monthStart.date.getMonth()] : ''
  })
  const yearlyRecordCount = [...completionCounts.values()].reduce((total, count) => total + count, 0)

  return (
    <section className="border-y border-rail py-5 sm:py-6" aria-labelledby="heatmap-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">Year trail</div>
          <h2 id="heatmap-title" className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
            {year} 年度热力
          </h2>
        </div>
        <div className="text-sm font-semibold text-graphite">{yearlyRecordCount} 条公开锁定记录</div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-max">
          <div className="ml-9 grid grid-flow-col gap-1 [grid-auto-columns:0.82rem] sm:[grid-auto-columns:0.9rem]" aria-hidden="true">
            {monthMarkers.map((label, index) => (
              <span key={`${label}-${index}`} className="h-5 text-[10px] font-medium leading-5 text-graphite">
                {label}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <div className="grid shrink-0 grid-rows-7 gap-1 pt-px font-mono text-[10px] font-medium leading-3 text-graphite" aria-hidden="true">
              {weekdays.map((weekday) => (
                <span key={weekday} className="grid size-3 place-items-center sm:size-3.5">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid shrink-0 grid-flow-col grid-rows-7 gap-1 [grid-auto-columns:0.82rem] sm:[grid-auto-columns:0.9rem]">
              {days.map(({ date, count, inYear }) => (
                <span
                  key={dayKey(date)}
                  title={inYear ? `${date.toLocaleDateString('zh-CN')}：${count} 条公开锁定记录` : undefined}
                  aria-label={inYear ? `${date.toLocaleDateString('zh-CN')}，${count} 条公开锁定记录` : undefined}
                  className={`aspect-square w-full rounded-[3px] ${inYear ? intensityClass(count, highestCount) : 'bg-transparent'}`}
                />
              ))}
            </div>
          </div>
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
