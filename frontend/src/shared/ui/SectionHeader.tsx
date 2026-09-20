import type { ReactNode } from 'react'

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  action?: ReactNode
}

export function SectionHeader({ eyebrow, title, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <div className="font-mono text-xs font-semibold uppercase text-signal">{eyebrow}</div> : null}
        <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  )
}
