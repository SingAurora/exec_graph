import { Link } from 'react-router-dom'
import { ProjectGraph } from '@/widgets/project/ui/ProjectGraph'
import { SectionHeader } from '@/shared/ui/SectionHeader'
import type { ExecutionBranch, ExecutionContract } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import { projectTabs, type ProjectTab } from './project-shared'

export function ProjectTabs({ project, activeTab }: { project: Project; activeTab: ProjectTab }) {
  const projectUuid = project.uuid
  return (
    <nav className="-mt-5 flex gap-1 overflow-x-auto border-b border-rail" aria-label="项目页面">
      {projectTabs.map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            to={tab.id === 'nodes' ? `/projects/${projectUuid}` : `/projects/${projectUuid}?tab=${tab.id}`}
            className={[
              'inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline',
              active ? 'border-ink text-ink' : 'border-transparent text-graphite hover:border-rail hover:text-ink',
            ].join(' ')}
          >
            <Icon size={16} aria-hidden="true" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function ProjectGraphTab({ project, contracts, branches }: { project: Project; contracts: ExecutionContract[]; branches: ExecutionBranch[] }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader eyebrow="节点关系" title="从上到下推进" />
        <div className="font-mono text-xs font-semibold text-signal">{contracts.length} 个节点 · {branches.length > 0 ? `${branches.length} 条路径` : '单一路径'}</div>
      </div>
      {contracts.length > 0 ? (
        <>
          <ProjectGraphLegend />
          <ProjectGraph projectUuid={project.uuid} heightClassName="h-[620px] min-h-[420px]" />
        </>
      ) : (
        <div className="border-l-2 border-moss py-2 pl-4 text-sm leading-6 text-graphite">第一项行为通过审查后，这里会成为项目的推进记录。</div>
      )}
    </section>
  )
}

export function ProjectGraphLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3 border-y border-rail py-3 text-xs font-semibold text-graphite" aria-label="关系图图例">
      <LegendNode label="待推进" className="border-signal bg-surface" />
      <LegendNode label="待确认" className="border-moss bg-moss/10" />
      <LegendNode label="有缺口" className="border-clay bg-clay/10" />
      <LegendNode label="已验收" className="border-moss bg-moss/10 ring-2 ring-moss/35" />
      <LegendNode label="已封存" className="border-graphite bg-paper border-dashed" />
      <LegendLine label="继续" className="border-graphite" />
      <LegendLine label="分叉" className="border-signal border-dashed" />
      <LegendLine label="补充" className="border-clay border-dashed" />
      <LegendLine label="收束" className="border-moss border-dashed" />
      <LegendLine label="重新尝试" className="border-graphite border-dotted" />
    </div>
  )
}

export function LegendNode({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3.5 w-3.5 rounded-full border-2 ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export function LegendLine({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-0 w-7 border-t-2 ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}


