import { ChevronDown, ScrollText } from 'lucide-react'
import type { ActionContinuationSource, ActionDocumentUpdateMode } from '../../../entities/action/model/types'
import type { AIActionAgreementReview } from '../../ai-key/lib/action-agreement-review'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { Select } from '../../../shared/ui/select/Select'
import { SourceAgreementReviews } from './SourceAgreementReviews'

/** 编辑本节点向后提出的约定；下方单独展示本次引用需核对的来源约定，两者互不覆盖。 */
export function ActionAgreementEditor({ hasParent, inheritedAgreement, mode, draft, onModeChange, onDraftChange, disabled = false, sourceNodeNumber, sourceReview, sources, reviews = [] }: {
  hasParent: boolean
  inheritedAgreement: string
  mode: ActionDocumentUpdateMode
  draft: string
  onModeChange: (mode: ActionDocumentUpdateMode) => void
  onDraftChange: (markdown: string) => void
  disabled?: boolean
  sourceNodeNumber?: number
  sourceReview?: { complies: boolean | null; reason: string }
  sources?: ActionContinuationSource[]
  reviews?: AIActionAgreementReview[]
}) {
  return (
    <><section className="px-6 pb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">本节点约定</span>
          <HelpPopover title="约定的更新">
            <p>约定用于约束后续引用本节点时的 AI 对话和生成记录。默认沿承接关系继承；修改或清空从本节点向后生效，合入来源不会自动拼接。</p>
            <p>本次行动仍需核对来源节点的有效约定；修改后续约定不会改变本次引用的要求。不满足时在连线上标记 ×，仍可引用。</p>
          </HelpPopover>
        </div>
        <Select className="!border !border-line !bg-paper" label="约定处理方式" value={mode} disabled={disabled}
          onValueChange={(value) => onModeChange(value as ActionDocumentUpdateMode)}
          options={[
            { value: 'inherit', label: hasParent ? inheritedAgreement.trim() ? '沿用上个节点' : '不设置约定' : '暂不设置' },
            { value: 'update', label: inheritedAgreement.trim() ? '修改约定' : '设置约定' },
            ...(hasParent && inheritedAgreement.trim() ? [{ value: 'clear', label: '清空约定' }] : []),
          ]} />
      </div>
      {mode === 'update' ? <textarea className="mt-3 min-h-28 w-full resize-y rounded border border-line bg-paper px-3 py-2 text-[13px] leading-[1.7] outline-none focus:border-signal disabled:opacity-50" title="本节点的约定" placeholder="后续引用这个节点时，需要遵守什么" value={draft} disabled={disabled} onChange={(event) => onDraftChange(event.target.value)} />
        : mode === 'inherit' && inheritedAgreement.trim() ? <div className="mt-3"><MarkdownContent markdown={inheritedAgreement} /></div>
          : <p className="mt-3 text-xs text-muted">无约定</p>}
    </section>
      {sources?.length ? <SourceAgreementReviews sources={sources} reviews={reviews} /> : hasParent && inheritedAgreement.trim() && <details className="group/source-agreement border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-3 text-xs leading-5 text-muted [&::-webkit-details-marker]:hidden"><ScrollText size={14} />来源约定{sourceNodeNumber !== undefined && <span>#{sourceNodeNumber}</span>}<span className={`ml-auto ${sourceReview?.complies === false ? 'text-coral' : sourceReview?.complies === true ? 'text-signal' : ''}`}>{sourceReview?.complies === false ? '× 不满足约定' : sourceReview?.complies === true ? '满足约定' : '尚未核对'}</span><ChevronDown size={13} className="transition-transform group-open/source-agreement:rotate-180" /></summary>
        <div className="px-6 pb-4">
          {sourceReview?.complies === false && <p className="mb-3 text-xs leading-6 text-coral">不符合原因：{sourceReview.reason}</p>}
          <MarkdownContent markdown={inheritedAgreement} />
        </div>
      </details>}
    </>
  )
}
