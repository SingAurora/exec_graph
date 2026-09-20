import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, CircleDotDashed, Flag, LoaderCircle, LockKeyhole } from 'lucide-react'
import { getMonthlyWorkOverview, reviewDailyActivity, type DailyActivity, type DailyReview, type WorkDay, type WorkOverview } from '@/features/work-overview/api/client'

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const activityCopy: Record<DailyActivity['kind'], { label: string; icon: typeof CircleDotDashed; className: string }> = {
  started: { label: '开始行动', icon: CircleDotDashed, className: 'text-amber' },
  completed: { label: '验收完成', icon: CheckCircle2, className: 'text-moss' },
  sealed: { label: '封存记录', icon: LockKeyhole, className: 'text-graphite' },
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(value)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: offset + count }, (_, index) => (index < offset ? undefined : new Date(month.getFullYear(), month.getMonth(), index - offset + 1)))
}

function activityTone(activities: DailyActivity[]) {
  if (activities.some((activity) => activity.kind === 'completed')) return 'bg-moss'
  if (activities.some((activity) => activity.kind === 'started')) return 'bg-amber'
  return 'bg-graphite'
}

export function WorkMonthView({ accessToken }: { accessToken: string }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [overview, setOverview] = useState<WorkOverview | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
	void getMonthlyWorkOverview(accessToken, monthValue(month))
      .then((data) => {
        if (cancelled) return
        setOverview(data)
        const today = localDateKey(new Date())
        const firstRecordedDate = data.days.find((day) => day.activities.length > 0 || day.review)?.date
        setSelectedDate((current) => current.startsWith(data.month) ? current : (today.startsWith(data.month) ? today : firstRecordedDate ?? `${data.month}-01`))
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : '读取工作月历失败。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [accessToken, month])

  const dayByDate = useMemo(() => new Map((overview?.days ?? []).map((day) => [day.date, day])), [overview])
  const selectedDay = dayByDate.get(selectedDate)
  const days = useMemo(() => calendarDays(month), [month])
  const activeDays = [...dayByDate.values()].filter((day) => day.activities.length > 0).length
  const acceptedCount = [...dayByDate.values()].flatMap((day) => day.activities).filter((activity) => activity.kind === 'completed').length

  const reviewDay = async () => {
    if (!selectedDay || selectedDay.activities.length === 0) return
    setReviewing(true)
    setError('')
    try {
		const data = await reviewDailyActivity(accessToken, selectedDate)
      setOverview((current) => current ? {
        ...current,
        days: current.days.map((day) => day.date === selectedDate ? { ...day, review: data.review } : day),
      } : current)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI 日结分析失败。')
    } finally {
      setReviewing(false)
    }
  }

  return (
    <section className="border-y border-rail bg-surface" aria-labelledby="work-month-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rail px-5 py-5">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">个人工作记录</div>
          <h2 id="work-month-title" className="mt-1 font-display text-2xl font-semibold text-ink">月度行动</h2>
          <p className="mt-1 text-sm text-graphite">{activeDays} 个有记录的工作日 · {acceptedCount} 条验收完成</p>
        </div>
        <div className="flex items-center gap-1" aria-label="切换月份">
          <button type="button" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-md border border-rail text-graphite transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline" aria-label="上个月" title="上个月"><ChevronLeft size={17} aria-hidden="true" /></button>
          <span className="min-w-24 px-2 text-center text-sm font-semibold text-ink">{formatMonth(month)}</span>
          <button type="button" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-md border border-rail text-graphite transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline" aria-label="下个月" title="下个月"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-rail bg-shell/40" aria-hidden="true">
        {weekdayLabels.map((weekday) => <span key={weekday} className="px-2 py-2 text-center font-mono text-[11px] font-semibold text-graphite">{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="min-h-16 border-b border-r border-rail/70 bg-shell/25 sm:min-h-20" />
          const key = localDateKey(date)
          const day = dayByDate.get(key)
          const active = (day?.activities.length ?? 0) > 0
          const selected = key === selectedDate
          return <button key={key} type="button" onClick={() => setSelectedDate(key)} className={`relative min-h-16 border-b border-r border-rail/70 p-2 text-left transition focus:outline-none focus-visible:shadow-focusline sm:min-h-20 ${selected ? 'bg-signal/10' : 'hover:bg-shell/65'} ${active ? 'text-ink' : 'text-graphite'}`} aria-label={`${key}${active ? `，${day?.activities.length} 条工作记录` : '，无工作记录'}`} aria-pressed={selected}>
            <span className={`grid size-6 place-items-center text-xs font-semibold ${selected ? 'bg-signal text-white' : ''}`}>{date.getDate()}</span>
            {active ? <span className={`absolute bottom-2 left-2 size-1.5 rounded-full ${activityTone(day?.activities ?? [])}`} aria-hidden="true" /> : null}
            {day?.review ? <Bot size={12} className="absolute bottom-1.5 right-1.5 text-signal" aria-label="已有 AI 日结" /> : null}
            {active ? <span className="absolute bottom-1.5 right-2 font-mono text-[10px] font-semibold text-graphite">{day?.activities.length}</span> : null}
          </button>
        })}
      </div>

      <div className="min-h-48 px-5 py-5">
        {loading ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />读取月度记录</div> : null}
        {!loading && !selectedDay ? <div><div className="font-mono text-xs font-semibold uppercase text-graphite">{selectedDate}</div><h3 className="mt-2 text-lg font-semibold text-ink">当天没有记录</h3><p className="mt-1 text-sm leading-6 text-graphite">记录推进、开始行动或完成验收后，会显示在这里。</p></div> : null}
        {!loading && selectedDay ? <DailyDetail day={selectedDay} reviewing={reviewing} onReview={reviewDay} /> : null}
        {error ? <p className="mt-4 border-l-2 border-clay pl-3 text-sm leading-6 text-clay">{error}</p> : null}
      </div>
    </section>
  )
}

function DailyDetail({ day, reviewing, onReview }: { day: WorkDay; reviewing: boolean; onReview: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="font-mono text-xs font-semibold uppercase text-signal">{day.date}</div><h3 className="mt-1 text-lg font-semibold text-ink">当天行动</h3></div>
        {day.activities.length > 0 ? <button type="button" onClick={onReview} disabled={reviewing} className="inline-flex h-9 items-center gap-2 bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:opacity-50"><Bot size={15} aria-hidden="true" />{reviewing ? '正在分析' : day.review ? '重新分析' : 'AI 分析当日状态'}</button> : null}
      </div>
      {day.activities.length > 0 ? <>
        <DayTimeline activities={day.activities.filter((activity) => activity.startedAt || activity.endedAt)} />
        <div className="mt-5 divide-y divide-rail border-y border-rail">{day.activities.map((activity) => <ActivityRow key={activity.uuid} activity={activity} />)}</div>
      </> : <p className="mt-4 text-sm leading-6 text-graphite">当天没有行动记录。</p>}
    </div>
    {day.review ? <DailyReviewDetail review={day.review} /> : <div className="border-l border-rail pl-5 text-sm leading-6 text-graphite">AI 日结会基于当天行动记录生成，不会改变任何验收结论。</div>}
  </div>
}

function ActivityRow({ activity }: { activity: DailyActivity }) {
  const copy = activityCopy[activity.kind]
  const Icon = copy.icon
  return <div className="flex gap-3 py-3 first:pt-3 last:pb-3"><Icon size={16} className={`mt-0.5 shrink-0 ${copy.className}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="text-xs font-semibold text-graphite">{copy.label} · {activity.projectTitle}</span><time className="font-mono text-xs text-graphite">{activity.startedAt ? `${formatTime(activity.startedAt)}${activity.endedAt ? `–${formatTime(activity.endedAt)}` : ''}` : formatTime(activity.createdAt)}</time></div><h4 className="mt-1 text-sm font-semibold text-ink">{activity.title}</h4>{activity.detail ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-graphite">{activity.detail}</p> : null}</div></div>
}

function DayTimeline({ activities }: { activities: DailyActivity[] }) {
  if (activities.length === 0) return null
  const positioned = activities.map((activity) => {
    const start = new Date(activity.startedAt ?? activity.createdAt)
    const end = new Date(activity.endedAt ?? start.getTime() + 30 * 60 * 1000)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const duration = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000))
    return { activity, top: Math.max(0, Math.min(1439, startMinutes)) / 1440 * 100, height: Math.min(100 - Math.max(0, Math.min(1439, startMinutes)) / 1440 * 100, Math.max(3.5, duration / 1440 * 100)) }
  })
  return <div className="mt-5 border-y border-rail py-4" aria-label="当天时间轴"><div className="flex items-center justify-between"><div className="text-sm font-semibold text-ink">当天时间轴</div><div className="text-xs text-graphite">已填写时间的行动</div></div><div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] gap-3"><div className="relative h-[360px] text-[10px] font-mono text-graphite">{[0, 6, 12, 18, 24].map((hour) => <span key={hour} className="absolute right-0" style={{ top: `${hour / 24 * 100}%`, transform: hour === 24 ? 'translateY(-100%)' : 'none' }}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="relative h-[360px] overflow-hidden border-l border-rail bg-shell/35">{[0, 6, 12, 18, 24].map((hour) => <span key={hour} className="absolute inset-x-0 border-t border-rail/70" style={{ top: `${hour / 24 * 100}%` }} />)}{positioned.map(({ activity, top, height }) => <a key={activity.uuid} href={activity.nodeUuid ? `/contracts/${activity.nodeUuid}?tab=completion` : undefined} className="absolute inset-x-2 overflow-hidden border-l-2 border-signal bg-signal/15 px-2 py-1 text-left transition hover:bg-signal/25" style={{ top: `${top}%`, height: `${height}%`, minHeight: '32px' }}><span className="block truncate text-xs font-semibold text-ink">{activity.title}</span><span className="block truncate text-[10px] text-graphite">{activity.projectTitle} · {formatTime(activity.startedAt ?? activity.createdAt)}{activity.endedAt ? `–${formatTime(activity.endedAt)}` : ''}</span></a>)}</div></div></div>
}

function DailyReviewDetail({ review }: { review: DailyReview }) {
  return <aside className="border-l-2 border-signal pl-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} aria-hidden="true" />AI 日结</div><h3 className="mt-2 text-lg font-semibold text-ink">{review.momentum}</h3><p className="mt-2 text-sm leading-6 text-graphite">{review.summary}</p>{review.highlights.length > 0 ? <ReviewList title="已形成的推进" items={review.highlights} /> : null}{review.friction.length > 0 ? <ReviewList title="需要留意" items={review.friction} /> : null}<div className="mt-4 border-t border-rail pt-3"><div className="flex items-center gap-2 text-sm font-semibold text-ink"><Flag size={15} className="text-signal" aria-hidden="true" />下一步</div><p className="mt-1 text-sm leading-6 text-graphite">{review.nextStep}</p></div><p className="mt-4 text-xs text-graphite">{review.aiConfig.label} · {review.aiConfig.model}</p></aside>
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return <div className="mt-4"><div className="text-sm font-semibold text-ink">{title}</div><ul className="mt-2 space-y-2 text-sm leading-6 text-graphite">{items.map((item) => <li key={item} className="border-l border-rail pl-3">{item}</li>)}</ul></div>
}
