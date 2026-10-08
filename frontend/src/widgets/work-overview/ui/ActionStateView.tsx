import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDotDashed, History, LoaderCircle, LockKeyhole, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActionState, type ActionState, type ActionWindow, type DailyActivity } from '@/features/work-overview/api/client'

const windows: Array<{ value: ActionWindow; label: string }> = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
]

const activityCopy: Record<DailyActivity['kind'], { label: string; icon: typeof CircleDotDashed; className: string }> = {
  started: { label: '开始行动', icon: CircleDotDashed, className: 'text-amber' },
  completed: { label: '确认记录', icon: CheckCircle2, className: 'text-moss' },
  sealed: { label: '封存记录', icon: LockKeyhole, className: 'text-graphite' },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function confidenceLabel(value: ActionState['coverage']['confidence']) {
  if (value === 'high') return '记录较充分'
  if (value === 'medium') return '记录中等'
  return '记录偏少'
}

function changeLabel(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

export function ActionStateView({ accessToken }: { accessToken: string }) {
  const [window, setWindow] = useState<ActionWindow>('today')
  const [state, setState] = useState<ActionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void getActionState(accessToken, window)
      .then((data) => {
        if (!cancelled) setState(data)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : '读取行动状态失败。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [accessToken, window])

  return (
    <section className="border-y border-rail bg-surface" aria-labelledby="action-state-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rail px-5 py-5">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">行动状态</div>
          <h2 id="action-state-title" className="mt-1 font-display text-2xl font-semibold text-ink">最近留下了什么</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite">这里只整理已经记录的推进，不把记录数量当成行动力评分，也不替你判断现实结果。</p>
        </div>
        <a href="#work-month-title" className="inline-flex h-9 items-center gap-2 border border-rail px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline">
          <History size={15} aria-hidden="true" />
          查看月度记录
        </a>
      </div>

      <div className="flex gap-1 border-b border-rail px-5 pt-3" role="tablist" aria-label="行动状态时间范围">
        {windows.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={window === item.value} onClick={() => setWindow(item.value)} className={`border-b-2 px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${window === item.value ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-56 px-5 py-5">
        {loading ? <div className="flex items-center gap-2 text-sm text-graphite"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />正在读取已记录事实</div> : null}
        {!loading && error ? <p className="border-l-2 border-clay pl-3 text-sm leading-6 text-clay">{error}</p> : null}
        {!loading && !error && state ? <ActionStateDetail state={state} /> : null}
      </div>
    </section>
  )
}

function ActionStateDetail({ state }: { state: ActionState }) {
  const { coverage, facts, comparison } = state
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span>{formatDate(state.range.start)}–{formatDate(state.range.end)}</span>
          {state.range.partial ? <span className="font-normal text-graphite">截至现在</span> : null}
        </div>
        <span className="font-mono text-xs font-semibold text-graphite">{confidenceLabel(coverage.confidence)} · {coverage.activeDays}/{coverage.windowDays} 天有记录</span>
      </div>

      <div className="mt-5 grid border-y border-rail sm:grid-cols-4">
        <FactCell label="行动记录" value={facts.activities} />
        <FactCell label="开始行动" value={facts.started} />
        <FactCell label="确认记录" value={facts.confirmedRecords} />
        <FactCell label="封存记录" value={facts.sealedRecords} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Activity size={15} className="text-signal" aria-hidden="true" />最近记录</div>
          {state.recentActivities.length > 0 ? <div className="mt-3 divide-y divide-rail border-y border-rail">{state.recentActivities.slice(0, 8).map((activity) => <RecentActivity key={activity.uuid} activity={activity} />)}</div> : <p className="mt-3 border-y border-rail py-4 text-sm leading-6 text-graphite">这个时间范围还没有可读取的行动记录。</p>}
        </div>
        <aside className="border-l-2 border-signal pl-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Activity size={15} className="text-signal" aria-hidden="true" />记录变化</div>
          <p className="mt-2 text-sm leading-6 text-graphite">{comparison.conclusion}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-rail pt-3 text-sm">
            <ComparisonCell label="行动记录" value={changeLabel(comparison.activityChange)} />
            <ComparisonCell label="有记录的天数" value={changeLabel(comparison.activeDaysChange)} />
          </div>
          <p className="mt-4 text-xs leading-5 text-graphite">对比上一段同长度时间。记录变多或变少都需要结合具体内容理解。</p>
        </aside>
      </div>
    </div>
  )
}

function FactCell({ label, value }: { label: string; value: number }) {
  return <div className="border-b border-r border-rail px-4 py-4 last:border-r-0 sm:border-b-0"><div className="font-mono text-[11px] font-semibold uppercase text-graphite">{label}</div><div className="mt-2 font-display text-2xl font-semibold text-ink">{value}</div></div>
}

function ComparisonCell({ label, value }: { label: string; value: string }) {
  const numericValue = Number(value)
  const Icon = numericValue > 0 ? ArrowUpRight : numericValue < 0 ? ArrowDownRight : Minus
  return <div><div className="text-xs text-graphite">{label}</div><div className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-ink"><Icon size={14} className={numericValue > 0 ? 'text-moss' : 'text-graphite'} aria-hidden="true" />{value}</div></div>
}

function RecentActivity({ activity }: { activity: DailyActivity }) {
  const copy = activityCopy[activity.kind]
  const Icon = copy.icon
  const content = <div className="flex gap-3 py-3"><Icon size={16} className={`mt-0.5 shrink-0 ${copy.className}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="text-xs font-semibold text-graphite">{copy.label} · {activity.projectTitle}</span><time className="font-mono text-xs text-graphite">{formatTime(activity.createdAt)}</time></div><div className="mt-1 text-sm font-semibold text-ink">{activity.title}</div>{activity.detail ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-graphite">{activity.detail}</p> : null}</div></div>
  return activity.nodeUuid ? <Link to={`/contracts/${activity.nodeUuid}?tab=completion`} className="block transition hover:bg-shell/45 focus:outline-none focus-visible:shadow-focusline">{content}</Link> : <div>{content}</div>
}
