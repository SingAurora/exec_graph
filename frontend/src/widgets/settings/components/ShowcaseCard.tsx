import { useId, type ReactNode } from 'react'

type ShowcaseCardProps = {
  name: string
  term: string
  source: '项目封装 · Radix UI' | 'Radix UI 基础组件' | '项目组件' | '项目样式' | '原生控件'
  description: string
  children: ReactNode
}

/** Gives each interactive example a name, purpose and implementation source. */
export function ShowcaseCard({ name, term, source, description, children }: ShowcaseCardProps) {
  const titleId = useId()
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-line bg-surface" aria-labelledby={titleId}>
      <header className="px-5 pt-5 pb-4">
        <h3 id={titleId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-[13px] font-semibold">{name}</span><span className="font-sans text-[11px] font-normal text-muted">{term}</span></h3>
        <p className="mt-2 text-xs leading-[1.8] text-muted">{description}</p>
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col justify-center gap-3 border-y border-line bg-paper/60 px-5 py-5">{children}</div>
      <footer className="px-5 py-2.5 text-[10px] text-muted">{source}</footer>
    </section>
  )
}
