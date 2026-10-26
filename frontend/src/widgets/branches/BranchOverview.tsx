import { GitBranch, TrendingUp } from 'lucide-react'
import type { CompletionNode, PlanNode } from '../../entities/action/model/legacy-types'
import { buildBranchSummaries } from '../../features/action/lib/branches'

type BranchOverviewProps = {
  plans: PlanNode[]
  completions: CompletionNode[]
}

export function BranchOverview({ plans, completions }: BranchOverviewProps) {
  const branches = buildBranchSummaries(plans, completions)
  if (!branches.length) return null
  const mainBranch = branches[0]

  return (
    <section className="border-y border-line py-[18px]">
      <div className="flex items-start justify-between gap-4"><div><span className="section-kicker">执行上下文</span><h2 className="mt-[7px] text-[19px] tracking-[-.025em]">当前主线</h2></div><span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-signal"><GitBranch size={14} />{branches.length} 条路径</span></div>
      <div className="mt-[13px] grid gap-2.5">
        {branches.slice(0, 3).map((branch) => <div className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-l-2 px-3 py-2.5 ${branch.isMain ? 'border-signal bg-signal-soft' : 'border-line bg-surface'}`} key={branch.id}>
          <span className={`grid size-6 place-items-center rounded-md ${branch.isMain ? 'bg-signal text-white' : 'bg-soft text-muted'}`}><GitBranch size={13} /></span>
          <span className="grid min-w-0 gap-0.5"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{branch.title}</strong><small className="text-[10px] text-muted">{branch.completedCount} 条完成 · {branch.continuationCount} 次接续</small></span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${branch.isMain ? 'text-signal' : 'text-muted'}`}>{branch.isMain ? <><TrendingUp size={12} />主线</> : '候选'}</span>
        </div>)}
      </div>
      {branches.length > 3 && <p className="mt-2 text-[10px] text-muted">还有 {branches.length - 3} 条路径，继续执行后会参与主线排序。</p>}
      <p className="mt-3 text-[11px] leading-[1.6] text-muted">主线会根据完成记录、后续接续和执行反馈变化；其他路径仍然可以继续。</p>
      <span className="sr-only">当前主线是{mainBranch.title}</span>
    </section>
  )
}
