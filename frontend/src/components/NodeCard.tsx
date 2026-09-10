import { ArrowRight, Bot, FileCheck2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'
import type { ExecutionContract } from '../types'
import { StatusBadge } from './StatusBadge'

type NodeCardProps = {
  node: ExecutionContract
  compact?: boolean
  actionLabel?: string
}

const verdictLabel = {
  pass: 'AI: 通过',
  partial: 'AI: 有缺口',
  fail: 'AI: 未关闭',
}

export function NodeCard({ node, compact = false, actionLabel = '查看节点' }: NodeCardProps) {
  const project = useExecStore((state) => state.projects.find((item) => item.id === node.projectId))
  const smartContract = useExecStore((state) => state.smartContracts.find((item) => item.id === node.smartContractId))

  return (
    <Link
      to={`/contracts/${node.id}`}
      className="group relative block overflow-hidden rounded-md border border-rail bg-surface p-4 transition hover:border-signal/60 hover:bg-shell/25 focus:outline-none focus-visible:shadow-focusline"
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${node.stage === 'completed' ? 'bg-moss' : node.stage === 'sealed' ? 'bg-graphite' : node.stage === 'needs_supplement' ? 'bg-clay' : node.stage === 'verified' ? 'bg-moss' : 'bg-signal'}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-graphite">{project?.title}</div>
          <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{node.title}</h3>
        </div>
        <StatusBadge stage={node.stage} />
      </div>

      {!compact ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-graphite">{node.verifiableGoal}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-graphite">
        <span className="inline-flex items-center gap-1.5">
          <Bot size={14} aria-hidden="true" />
          {smartContract?.name}
        </span>
        {node.aiReview ? (
          <span className="inline-flex items-center gap-1.5">
            <FileCheck2 size={14} aria-hidden="true" />
            {verdictLabel[node.aiReview.verdict]}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-ink">
          {actionLabel}
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
