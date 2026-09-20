import { Archive, Compass, Eye, ListChecks, LockKeyhole } from 'lucide-react'
import type { Project } from '@/entities/project/model/types'

export function ProjectVisibilityBadge({ visibility }: { visibility: Project['visibility'] }) {
  const isPublic = visibility === 'public'
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 normal-case ${isPublic ? 'border-signal/30 bg-signal/10 text-signal' : 'border-rail bg-surface/70 text-graphite'}`}>{isPublic ? <Eye size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{isPublic ? '公开项目' : '私人项目'}</span>
}

export function ProjectTypeBadge({ projectType }: { projectType: Project['projectType'] }) {
  const guided = projectType === 'guided'
  return <span className="inline-flex items-center gap-1 rounded-md border border-rail bg-surface/70 px-2 py-1 normal-case text-graphite">{guided ? <ListChecks size={13} aria-hidden="true" /> : <Compass size={13} aria-hidden="true" />}{guided ? '规则引导型' : '自主推进型'}</span>
}

export function ProjectArchiveBadge() {
  return <span className="inline-flex items-center gap-1 rounded-md border border-graphite/20 bg-surface/70 px-2 py-1 normal-case text-graphite"><Archive size={13} aria-hidden="true" />已归档</span>
}

export function ArchivedProjectNotice() {
  return <section className="border-y border-rail py-8"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-graphite"><Archive size={16} aria-hidden="true" />Read-only project</div><h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">项目已归档</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">完成记录、行为路径和审查证据会一直保留，但不能再开始行为、提交结果、签名或修改项目智能合约。</p></section>
}
