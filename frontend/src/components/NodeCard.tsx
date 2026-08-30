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
      className="group block rounded-md border border-rail bg-white/72 p-4 transition hover:-translate-y-0.5 hover:border-graphite/40 hover:bg-white focus:outline-none focus-visible:shadow-focusline"
    >
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
