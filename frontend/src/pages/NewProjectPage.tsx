import { ArrowLeft, FolderPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProjectComposer } from '../components/ProjectComposer'

export function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="border-b border-rail pb-7">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          返回我的项目
        </Link>
        <div className="mt-8 flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
          <FolderPlus size={15} aria-hidden="true" />
          我的项目
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">新建项目</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">先为项目选择一份智能合约，之后的每个执行节点都会继承这套规则。</p>
      </section>

      <ProjectComposer />
    </div>
  )
}
