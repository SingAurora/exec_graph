import type { ContractStage } from '@/entities/execution-node/model/types'

const stageMeta: Record<ContractStage, { label: string; className: string }> = {
  frozen: {
    label: '待推进',
    className: 'border-signal/30 bg-signal/10 text-signal',
  },
  verified: {
    label: '待确认 AI 结果',
    className: 'border-moss/35 bg-moss/12 text-moss',
  },
  needs_supplement: {
    label: '待确认 AI 结果',
    className: 'border-clay/40 bg-clay/12 text-clay',
  },
  completed: {
    label: '已验收',
    className: 'border-moss/40 bg-moss/12 text-moss',
  },
  sealed: {
    label: '已封存',
    className: 'border-graphite/30 bg-shell text-graphite',
  },
}

export function StatusBadge({ stage }: { stage: ContractStage }) {
  const meta = stageMeta[stage]

  return (
    <span
      className={`inline-flex h-7 items-center rounded-md border px-2.5 font-mono text-[12px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}
