import type { ReactNode } from 'react'
import type { Project } from '../model/types'
import { defaultProjectBackground } from '../lib/appearance'
import { ProjectAvatar } from './ProjectAvatar'

/** Graph identity on an acrylic footer over a full-card cover. */
export function ProjectHeader({ project, participantCount, expressionCount, actions }: { project: Project; participantCount: number; expressionCount: number; actions?: ReactNode }) {
  return (
    <header className="relative isolate flex min-h-[240px] items-end overflow-hidden rounded-lg border border-line bg-soft" aria-label="图名片">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${project.backgroundImage?.trim() || defaultProjectBackground}")` }} aria-hidden="true" />
      <div className="relative flex w-full min-w-0 items-center gap-2.5 border-t border-none bg-white/30 px-6 py-4 backdrop-blur-sm backdrop-saturate-150 dark:border-none dark:bg-black/30">
        <span className="inline-flex flex-none rounded-xl ring-1 ring-white/60 dark:ring-white/20"><ProjectAvatar project={project} size="card" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold leading-[1.35] tracking-[-.025em] text-ink">{project.title}</h2>
          <dl className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-copy" aria-label="图统计">
            <div className="inline-flex items-baseline gap-1"><dd className="font-semibold tabular-nums text-ink">{participantCount}</dd><dt>人参与</dt></div>
            <div className="inline-flex items-baseline gap-1"><dd className="font-semibold tabular-nums text-ink">{expressionCount}</dd><dt>条表达</dt></div>
          </dl>
        </div>
        {actions && <div className="ml-auto flex-none pl-4">{actions}</div>}
      </div>
    </header>
  )
}
