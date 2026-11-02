import { useEffect, useState } from 'react'
import { getNodeDocumentHistory, type NodeDocumentVersion } from '../api/generation'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { formatPublicationTime } from '../../../shared/lib/date'

const labels = { expression: '表达', agreement: '约定' } as const

/** 查看节点自己发布过的表达/约定版本，不提供覆盖历史版本的编辑。 */
export function NodeDocumentHistory({ nodeId, open, onOpenChange }: {
  nodeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [versions, setVersions] = useState<NodeDocumentVersion[]>([])
  const [kind, setKind] = useState<'expression' | 'agreement'>('expression')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setError('')
    void getNodeDocumentHistory(nodeId).then((next) => { if (active) setVersions(next) }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : '读取版本历史失败')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [nodeId, open])
  const current = versions.filter((version) => version.kind === kind).sort((a, b) => b.revision - a.revision)
  return <Dialog open={open} onOpenChange={onOpenChange} title="文档版本历史" description="查看节点发布过的表达和约定版本" className="!w-[min(100%-32px,680px)]">
    <div className="mt-4 flex gap-4 border-b border-line">
      {(['expression', 'agreement'] as const).map((value) => <button className={`min-h-9 border-0 border-b-2 bg-transparent px-0 text-sm font-medium ${kind === value ? 'border-signal text-signal' : 'border-transparent text-muted hover:text-signal'}`} type="button" key={value} onClick={() => setKind(value)}>{labels[value]}</button>)}
    </div>
    <div className="mt-3 max-h-[60vh] overflow-y-auto">
      {loading && <p className="py-6 text-sm text-muted">正在读取…</p>}
      {error && <p className="py-6 text-sm text-coral">{error}</p>}
      {!loading && !error && !current.length && <p className="py-6 text-sm text-muted">还没有发布过{labels[kind]}版本。</p>}
      {current.map((version, index) => <article className="border-b border-line py-4 last:border-0" key={`${version.kind}-${version.revision}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>版本 {version.revision}{index === 0 ? ' · 当前' : ''}</span><span>{version.generationId ? 'AI 生成' : '作者发布'} · {formatPublicationTime(version.createdAt)}</span></div>
        <div className="mt-2 max-h-56 overflow-y-auto"><MarkdownContent markdown={version.markdown} /></div>
      </article>)}
    </div>
  </Dialog>
}
