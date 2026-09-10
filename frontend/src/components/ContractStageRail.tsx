import { Circle, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import type { ContractStage } from '../types'

const stages: Array<{ id: string; label: string; icon: typeof FileText }> = [
  { id: 'ready', label: '待推进', icon: FileText },
  { id: 'review', label: '待确认 AI 结果', icon: Sparkles },
  { id: 'accepted', label: '已验收', icon: ShieldCheck },
]

const stageIndex: Record<ContractStage, number> = {
  frozen: 0,
  verified: 1,
  needs_supplement: 1,
  completed: 2,
  sealed: 2,
}

const reachedSteps: Record<ContractStage, number[]> = {
  frozen: [0],
  verified: [0, 1],
  needs_supplement: [0, 1],
  completed: [0, 1, 2],
  sealed: [0, 1, 2],
}

export function ContractStageRail({ stage }: { stage: ContractStage }) {
  const activeIndex = stageIndex[stage]

  return (
    <div className="border-y border-rail bg-surface px-5 py-4">
      <div className="font-mono text-xs font-semibold uppercase text-signal">验证轨</div>
      <div className="mt-4 flex items-start">
        {stages.map((item, index) => {
          const Icon = item.icon
          const reached = reachedSteps[stage].includes(index)
          const current = index === activeIndex
          const currentClass = stage === 'needs_supplement' ? 'border-clay bg-clay text-white' : stage === 'sealed' ? 'border-graphite bg-graphite text-white' : 'border-signal bg-signal text-white'
          return (
            <div key={item.id} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div className="min-w-0">
                <div className={`grid size-8 place-items-center rounded-full border ${current ? currentClass : reached ? 'border-moss bg-moss/10 text-moss' : 'border-rail bg-paper text-graphite'}`}>
                  {reached ? <Icon size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                </div>
                <div className={`mt-2 whitespace-nowrap text-xs font-semibold ${current ? (stage === 'needs_supplement' ? 'text-clay' : stage === 'sealed' ? 'text-graphite' : 'text-signal') : reached ? 'text-moss' : 'text-graphite'}`}>{stage === 'sealed' && item.id === 'accepted' ? '已封存' : item.label}</div>
              </div>
              {index < stages.length - 1 ? <div className={`mx-3 mt-[-22px] h-px min-w-4 flex-1 ${reachedSteps[stage].includes(index + 1) ? 'bg-moss' : 'bg-rail'}`} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
