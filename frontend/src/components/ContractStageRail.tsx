import { Circle, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import type { ContractStage } from '../types'

const stages: Array<{ id: string; label: string; icon: typeof FileText }> = [
  { id: 'ready', label: '待推进', icon: FileText },
  { id: 'review', label: '待确认 AI 结果', icon: Sparkles },
  { id: 'locked', label: '锁定', icon: ShieldCheck },
]

const stageIndex: Record<ContractStage, number> = {
  frozen: 0,
  verified: 1,
  needs_supplement: 1,
  completed: 2,
}

const reachedSteps: Record<ContractStage, number[]> = {
  frozen: [0],
  verified: [0, 1],
  needs_supplement: [0, 1],
  completed: [0, 1, 2],
}

export function ContractStageRail({ stage }: { stage: ContractStage }) {
  const activeIndex = stageIndex[stage]

  return (
    <div className="rounded-md border border-rail bg-white/72 p-4">
      <div className="font-mono text-xs font-semibold uppercase text-signal">节点状态</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stages.map((item, index) => {
          const Icon = item.icon
          const reached = reachedSteps[stage].includes(index)
          const current = index === activeIndex
          return (
            <div key={item.id} className="min-w-0">
              <div
                className={[
                  'flex h-12 items-center gap-2 rounded-md border px-3',
                  current
                    ? 'border-ink bg-ink text-paper'
                    : reached
                      ? 'border-moss/35 bg-moss/10 text-moss'
                      : 'border-rail bg-paper text-graphite',
                ].join(' ')}
              >
                {reached ? <Icon size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                <span className="truncate text-sm font-semibold">{item.label}</span>
              </div>
              {index < stages.length - 1 ? <div className="mx-5 hidden h-px bg-rail sm:block" /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
