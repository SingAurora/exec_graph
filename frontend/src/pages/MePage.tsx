import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CompletionHeatmap } from '../components/CompletionHeatmap'
import { SectionHeader } from '../components/SectionHeader'
import { useExecStore } from '../store/useExecStore'

export function MePage() {
  const currentActorId = useExecStore((state) => state.currentActorId)
  const contracts = useExecStore((state) => state.contracts)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const completed = completionRecords
    .filter((record) => contracts.find((contract) => contract.id === record.closingContractId)?.actorId === currentActorId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  return (
    <div className="space-y-8">
      <section className="border-b border-rail pb-6">
        <div className="font-mono text-xs font-semibold uppercase text-signal">Signed record</div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">执行足迹</h1>
      </section>

      <CompletionHeatmap records={completed} />

      <section className="space-y-4">
        <SectionHeader eyebrow="Linear record" title="阶段完成记录" />
        <div className="border-y border-rail bg-white/50">
          {completed.length > 0 ? (
            completed.slice().reverse().map((record, index) => (
              <Link key={record.id} to={`/contracts/${record.closingContractId}`} className="grid gap-3 border-b border-rail px-4 py-4 transition last:border-b-0 hover:bg-white sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center focus:outline-none focus-visible:shadow-focusline">
                <span className="font-mono text-xs font-semibold text-signal">{String(completed.length - index).padStart(2, '0')}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{record.title}</span><span className="mt-1 block text-xs text-graphite"><CheckCircle2 size={13} className="mr-1 inline text-moss" aria-hidden="true" />覆盖 {record.coveredContractIds.length} 个推进节点 · {record.aiReviewVerdict === 'pass' ? 'AI 审查通过 · 用户确认' : 'AI 审查未通过 · 用户锁定'} · {new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))}</span></span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-signal">查看收束节点<ArrowRight size={15} aria-hidden="true" /></span>
              </Link>
            ))
          ) : (
            <div className="p-5 text-sm leading-6 text-graphite">
              还没有阶段完成记录。
              <Link className="ml-1 font-semibold text-signal" to="/">
                前往我的项目
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
