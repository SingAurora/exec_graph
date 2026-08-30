import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthLayoutProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-paper px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)] lg:gap-20">
        <section className="border-b border-rail pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-16">
          <Link to="/login" className="inline-block focus:outline-none focus-visible:shadow-focusline">
            <div className="font-display text-4xl font-semibold leading-none">执行图谱</div>
            <div className="mt-3 text-sm leading-6 text-graphite">项目，验证，签名，接续</div>
          </Link>
        </section>

        <main className="w-full">
          <div className="font-mono text-xs font-semibold uppercase text-signal">{eyebrow}</div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-graphite">{description}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-5 text-sm leading-6 text-graphite">{footer}</div>
        </main>
      </div>
    </div>
  )
}
