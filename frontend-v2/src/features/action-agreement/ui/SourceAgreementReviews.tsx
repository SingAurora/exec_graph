import { ChevronDown } from 'lucide-react'
import type { ActionContinuationSource } from '../../../entities/action/model/types'
import type { AIActionAgreementReview } from '../../ai-key/lib/action-agreement-review'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'

/** Shows each incoming agreement and its independent assessment, including merged sources. */
export function SourceAgreementReviews({ sources, reviews }: { sources: ActionContinuationSource[]; reviews: AIActionAgreementReview[] }) {
  return <section className="border-t border-line px-6 pt-4" aria-label="本次引用的来源约定">
    <h3 className="mb-2 text-xs font-medium text-muted">来源约定</h3>
    {sources.map(({ node, kind, agreement }) => {
      const review = reviews.find((item) => item.nodeNumber === node.number)
      const unrestricted = !agreement.markdown.trim()
      const status = unrestricted ? '无约定' : review?.complies === false ? '× 不满足约定' : review?.complies === true ? '满足约定' : '尚未核对'
      return <details className="group/source border-b border-line py-3 last:border-0" key={node.id}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs leading-5 [&::-webkit-details-marker]:hidden">
          <span className="shrink-0 text-muted">{kind === 'primary' ? '承接' : '合入'} #{node.number}</span>
          <span className="min-w-0 flex-1 truncate" title={node.title}>{node.title}</span>
          <span className={`shrink-0 ${!unrestricted && review?.complies === false ? 'text-coral' : !unrestricted && review?.complies === true ? 'text-signal' : 'text-muted'}`}>{status}</span>
          <ChevronDown size={13} className="shrink-0 text-muted transition-transform group-open/source:rotate-180" />
        </summary>
        <div className="pt-3">
          {agreement.sourceNode && agreement.sourceNode.id !== node.id && <p className="mb-3 text-xs text-muted">约定继承自 节点 #{agreement.sourceNode.number}</p>}
          {!unrestricted && review?.reason && <p className={`mb-3 text-xs leading-6 ${review.complies === false ? 'text-coral' : 'text-muted'}`}>{review.complies === false ? '不符合原因：' : '核对说明：'}{review.reason}</p>}
          {unrestricted ? <p className="text-xs text-muted">无约定</p> : <MarkdownContent markdown={agreement.markdown} />}
        </div>
      </details>
    })}
  </section>
}
