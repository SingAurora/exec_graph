import type { ActionAgreement, ActionAgreementOrigin } from '../model/types'
import { getDocumentRevisionLabel } from '../lib/document-revision'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'

/** Reads the effective agreement with a compact link to its inherited or revised version. */
export function AgreementContent({ agreement, origin, onSelectSource }: {
  agreement: ActionAgreement
  origin?: ActionAgreementOrigin
  onSelectSource: (id: string) => void
}) {
  const hasContent = Boolean(agreement.markdown.trim())
  const source = origin?.node ?? (!hasContent ? agreement.sourceNode : undefined)
  const supplement = agreement.sourceNode?.agreementSupplement
  return <div>
    {source && <p className="mb-3 flex flex-wrap items-baseline gap-1 text-xs leading-5 text-muted">
      <span>{origin?.kind === 'modified' ? '修改自' : hasContent || origin ? '继承自' : '清空于'}</span>
      <button className="border-0 bg-transparent p-0 text-xs text-signal hover:underline" type="button" aria-label={`查看约定版本节点 #${source.number}`} onClick={() => onSelectSource(source.id)}>节点 #{source.number}</button>
    </p>}
    {supplement && <p className="mb-3 text-xs leading-5 text-muted">发布后{getDocumentRevisionLabel(supplement)}约定 · <time dateTime={supplement.createdAt} title={formatFullPublicationTime(supplement.createdAt)}>{formatPublicationTime(supplement.createdAt)}</time></p>}
    {hasContent ? <MarkdownContent markdown={agreement.markdown} /> : <p className="text-sm leading-[1.85] text-muted">无约定</p>}
  </div>
}
