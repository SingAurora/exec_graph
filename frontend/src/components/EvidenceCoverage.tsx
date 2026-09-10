import type { ExecutionContract } from '../types'

export function EvidenceCoverage({ contract }: { contract: ExecutionContract }) {
  const reviews = contract.aiReview?.criterionReviews ?? []
  const met = reviews.filter((review) => review.result === 'met').length
  const unclear = reviews.filter((review) => review.result === 'unclear').length
  const unmet = reviews.filter((review) => review.result === 'unmet').length
  const total = Math.max(reviews.length, contract.acceptanceCriteria.length, 1)
  const metPercent = reviews.length > 0 ? Math.round((met / total) * 100) : 0

  return (
    <div className="rounded-md border border-rail bg-surface/72 p-4">
      <div className="font-mono text-xs font-semibold uppercase text-signal">Evidence coverage</div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-3xl font-semibold">{reviews.length > 0 ? `${metPercent}%` : '-'}</div>
          <div className="mt-1 text-sm text-graphite">
            {reviews.length > 0 ? '验收覆盖度' : '等待 AI 审查'}
          </div>
        </div>
        <div className="text-right font-mono text-xs font-semibold text-graphite">
          {total} 条审查标准
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-rail">
        <div className="h-full bg-moss" style={{ width: `${metPercent}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <CoverageCount label="满足" value={met} />
        <CoverageCount label="证据不足" value={unclear} />
        <CoverageCount label="未满足" value={unmet} />
      </div>
    </div>
  )
}

function CoverageCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-rail bg-paper px-2 py-3">
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs font-semibold text-graphite">{label}</div>
    </div>
  )
}
