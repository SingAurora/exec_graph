import { GitMerge, Plus, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionAgreement } from '../../../entities/action/lib/agreements'
import { getActionMergeCandidates } from '../../../entities/action/lib/continuation'
import type { AIActionAgreementReview } from '../../ai-key/lib/action-agreement-review'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'

/** 从其他路线终点选择合入背景；保留主要承接关系，各来源约定独立展示。 */
export function MergeActionSources({ actions, parentId, selectedIds, reviews, disabled, onChange }: {
  actions: ActionNode[]
  parentId: string
  selectedIds: string[]
  reviews: AIActionAgreementReview[]
  disabled: boolean
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [previewId, setPreviewId] = useState<string>()
  const trigger = useRef<HTMLButtonElement>(null)
  const candidates = getActionMergeCandidates(actions, parentId)
  const candidateIds = new Set(candidates.map((node) => node.id))
  const term = query.trim().replace(/^#/u, '').toLocaleLowerCase()
  const visible = candidates.filter((node) => !term || String(node.number) === term || node.title.toLocaleLowerCase().includes(term))
  const preview = candidates.find((node) => node.id === previewId)
  const previewAgreement = preview ? getActionAgreement(actions, preview.id).markdown : ''
  const toggle = (id: string) => {
    if (disabled) return
    if (selectedIds.includes(id)) onChange(selectedIds.filter((item) => item !== id))
    else if (candidateIds.has(id)) onChange([...selectedIds, id])
  }
  return <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="合入来源">
    {selectedIds.slice(0, 3).map((id) => {
      const node = actions.find((item) => item.id === id)
      if (!node) return null
      const agreement = getActionAgreement(actions, id).markdown
      const review = reviews.find((item) => item.nodeNumber === node.number)
      const stale = !candidateIds.has(id)
      const status = stale ? '已非终端' : !agreement.trim() ? '无约定' : review?.complies === false ? '× 不满足约定' : review?.complies === true ? '满足约定' : '尚未核对'
      return <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-xs" key={id} title={node.title}>
        <GitMerge size={13} className="shrink-0 text-muted" /><span className="shrink-0">合入 #{node.number}</span>
        <span className={`truncate ${stale || agreement.trim() && review?.complies === false ? 'text-coral' : agreement.trim() && review?.complies === true ? 'text-signal' : 'text-muted'}`}>{status}</span>
        <button type="button" className="grid size-5 shrink-0 place-items-center rounded hover:bg-soft disabled:opacity-40" aria-label={`移除合入节点 #${node.number}`} disabled={disabled} onClick={() => toggle(id)}><X size={12} /></button>
      </span>
    })}
    {selectedIds.length > 3 && <button type="button" className="rounded-md px-2 py-1 text-xs text-muted hover:bg-paper hover:text-signal disabled:opacity-40" disabled={disabled} onClick={() => { setQuery(''); setOpen(true) }}>另 {selectedIds.length - 3} 个合入</button>}
    <div className="inline-flex items-center">
      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-paper hover:text-signal disabled:opacity-40" type="button" ref={trigger} disabled={disabled} onClick={() => setOpen(true)}><Plus size={14} />合入节点</button>
      <HelpPopover title="合入节点">
        <p>只能合入当前图内其他分支的终端节点，即尚未被后续节点承接或合入的节点。</p>
        <p>合入会将该节点及其引用历史纳入行动背景，因此选择分支最新的行动；承接节点及其已有历史无需重复选择。</p>
        <p>若选中的节点后来被接续或合入，会标记为“已非终端”。请移除后重新选择，并继续 AI 对话整理内容，再发布行动。</p>
      </HelpPopover>
    </div>
    <Dialog open={open} onOpenChange={setOpen} returnFocusRef={trigger} title="合入节点" description="选择其他分支的终端节点，预览行动记录和约定。" className="!w-[min(100%-32px,860px)]">
      <label className="mt-5 flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-muted"><Search size={15} /><input className="w-full border-0 bg-transparent text-sm text-ink outline-none" aria-label="搜索合入节点" placeholder="搜索节点编号或标题" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="mt-4 grid h-[min(55dvh,440px)] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <div className="overflow-y-auto pr-1" aria-label="可合入的节点">
          {visible.map((node) => <div key={node.id} className={`mb-1 flex items-start gap-2 rounded-md p-2 ${previewId === node.id ? 'bg-signal-soft' : 'hover:bg-soft'}`}>
            <input type="checkbox" className="mt-1 accent-signal" aria-label={`合入节点 #${node.number}`} checked={selectedIds.includes(node.id)} disabled={disabled} onChange={() => { setPreviewId(node.id); toggle(node.id) }} />
            <button type="button" className="min-w-0 flex-1 text-left text-[13px] leading-6" onClick={() => setPreviewId(node.id)}><span className="mr-2 text-xs tabular-nums text-muted">#{node.number}</span>{node.title}</button>
          </div>)}
          {!visible.length && <p className="py-8 text-center text-sm text-muted">{term ? '没有找到终端节点' : '暂无可合入的终端节点'}</p>}
        </div>
        <section className="min-w-0 overflow-y-auto border-l border-line pl-5" aria-label="合入节点预览">
          {preview ? <><p className="mb-2 text-xs text-muted">节点 #{preview.number}</p><h3 className="mb-4 text-sm font-semibold leading-6">{preview.title}</h3><MarkdownContent markdown={preview.objectiveMarkdown ?? preview.markdown} images={preview.images} /><div className="mt-5 border-t border-line pt-4"><h4 className="mb-3 text-xs font-medium text-muted">来源约定</h4>{previewAgreement.trim() ? <MarkdownContent markdown={previewAgreement} /> : <p className="text-xs text-muted">无约定</p>}</div></> : <p className="py-8 text-center text-sm text-muted">选择节点查看行动与约定</p>}
        </section>
      </div>
      <footer className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-xs text-muted">已合入 {selectedIds.length} 个节点</span><button className="primary-button" type="button" onClick={() => setOpen(false)}>完成</button></footer>
    </Dialog>
  </div>
}
