import { ChevronDown, ScrollText } from 'lucide-react'
import type { ActionNode } from '../../entities/action/model/types'
import { getActionAgreement, getActionAgreementOrigin } from '../../entities/action/lib/agreements'
import { getActionSourceAgreements } from '../../entities/action/lib/references'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'

/** Reads the existing node and source agreements while only its expression is being revised. */
export function ExpressionAgreements({ node, actions }: { node: ActionNode; actions: ActionNode[] }) {
  const agreement = getActionAgreement(actions, node.id)
  const origin = getActionAgreementOrigin(actions, node.id)
  const sources = getActionSourceAgreements(actions, node.id)
  return <>
    <section className="px-6 pb-5" aria-label="本节点约定">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">本节点约定</h3><span className="text-xs text-muted">只读</span></div>
      {origin && <p className="mb-3 text-xs text-muted">{origin.kind === 'inherited' ? '继承自' : '修改自'} 节点 #{origin.node.number}</p>}
      {agreement.markdown.trim() ? <MarkdownContent markdown={agreement.markdown} /> : <p className="text-sm text-muted">无约定</p>}
    </section>
    {sources.length > 0 && <details className="group/source-agreement border-t border-line" aria-label="本次引用的来源约定">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-3 text-xs leading-5 text-muted [&::-webkit-details-marker]:hidden"><ScrollText size={14} />来源约定 {sources.length}<ChevronDown size={13} className="ml-auto transition-transform group-open/source-agreement:rotate-180" /></summary>
      <div className="space-y-5 px-6 pb-5">
        {sources.map((source) => <section key={source.id} aria-label={`来源节点 #${source.source.number} 的约定`}>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span>节点 #{source.source.number}</span><span className={source.agreementStatus === 'exception' ? 'text-coral' : source.agreementStatus === 'satisfied' ? 'text-signal' : 'text-muted'}>{source.agreementStatus === 'exception' ? '× 不满足约定' : source.agreementStatus === 'satisfied' ? '满足约定' : '尚未核对'}</span></div>
          {source.exceptionReason && <p className="mb-3 text-xs leading-6 text-coral">不符合原因：{source.exceptionReason}</p>}
          <MarkdownContent markdown={source.agreement.markdown} />
        </section>)}
      </div>
    </details>}
  </>
}
