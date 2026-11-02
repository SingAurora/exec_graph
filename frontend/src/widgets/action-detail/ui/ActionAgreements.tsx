import { ChevronDown, ScrollText } from 'lucide-react'
import { useId, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionSourceAgreements, getUnreviewedAgreementCount } from '../../../entities/action/lib/references'
import { AgreementContent } from '../../../entities/action/ui/AgreementContent'
import type { UserProfile } from '../../../entities/profile/model/types'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'

/** 本次来源约定：逐条展示直接引用的条件及核对结果，与本节点的后续约定独立。 */
export function ActionSourceAgreements({ node, actions, users, onSelect }: { node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onSelect: (id: string) => void }) {
  const references = getActionSourceAgreements(actions, node.id)
  if (!references.length) return null
  const unreviewed = getUnreviewedAgreementCount(references)
  return (
    <details key={node.id} className="group/agreements rounded-lg border border-line bg-soft/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs leading-5 [&::-webkit-details-marker]:hidden">
        <ScrollText size={14} className="shrink-0 text-muted" />
        <span className="font-medium">来源约定 <span className="ml-1 font-normal tabular-nums text-muted">{references.length}</span></span>
        {unreviewed > 0 && <span className="text-coral">· 待核对 {unreviewed}</span>}
        <ChevronDown size={14} className="ml-auto shrink-0 text-muted transition-transform group-open/agreements:rotate-180" />
      </summary>
      <div className="border-t border-line px-3">
        <div className="flex items-center justify-between pt-2 text-xs text-muted"><span>处理记录</span><HelpPopover title="来源约定">
          <p>分别核对直接承接与合入来源的有效约定，包含来源沿承接关系继承的版本；一份约定中的多个条款仍算一份约定。</p>
          <p>待核对只统计尚未记录核对结果的来源。不满足约定时，连线上显示 × 并记录原因，仍可引用。</p>
          <p>不逐层叠加已被修改或清空的旧版本。修改本节点向后传递的约定，不会改变这次引用的核对结果。</p>
        </HelpPopover></div>
        <div className="divide-y divide-line">{references.map((reference) => {
          const sourceAuthor = users.find((user) => user.id === reference.source.authorId)?.name ?? reference.source.authorId
          const exception = reference.agreementStatus === 'exception'
          return (
            <section className="py-3" key={reference.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-5">
                <button className="border-0 bg-transparent p-0 text-xs text-signal hover:underline" type="button" title={reference.source.title} onClick={() => onSelect(reference.source.id)}>{reference.incorporated ? '合入' : '承接'} #{reference.source.number}</button>
                <span className="text-muted">{sourceAuthor}</span>
              </div>
              <p className={`mt-1.5 text-xs leading-5 ${exception ? 'text-coral' : reference.agreementStatus === 'satisfied' ? 'text-signal' : 'text-muted'}`}>
                {exception ? '× 不满足约定' : reference.agreementStatus === 'satisfied' ? '满足约定' : '尚未核对'}
              </p>
              {exception && <p className="mt-1.5 whitespace-pre-wrap text-xs leading-[1.8] text-muted">不符合原因：{reference.exceptionReason?.trim() || '尚未填写'}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs leading-5 text-muted hover:text-signal">查看约定</summary>
                <div className="mt-2 border-l-2 border-line pl-3"><AgreementContent agreement={reference.agreement} onSelectSource={onSelect} /></div>
              </details>
            </section>
          )
        })}</div>
      </div>
    </details>
  )
}

/** 本节点约定：留给后来引用者的条件；修改它不会改变本次已记录的来源核对。 */
export function ActionOwnAgreement({ node, onSelect }: { node: ActionNode; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const agreement = { markdown: node.agreementMarkdown ?? '' }
  return (
    <section className="rounded-lg border border-line bg-soft/40">
      <div className="flex items-center gap-3 px-3">
        <button className="flex min-h-10 min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left text-xs leading-5 hover:text-signal" type="button" onClick={() => setExpanded((value) => !value)}><ScrollText size={14} className="shrink-0 text-muted" /><span className="font-medium">约定</span>{!agreement.markdown.trim() && <span className="text-muted">无约定</span>}<ChevronDown size={14} className={`ml-auto shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
      </div>
      <div id={contentId} hidden={!expanded} className="border-t border-line p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>本节点对后续行动的条件</span><HelpPopover title="节点约定">
          <p>每个节点只使用自己的约定；子行动核对父节点已发布的约定，不继承、不拼接。</p>
          <p>满足约定表示有继续沟通的意愿；不满足只作为引用箭头状态，不阻止节点存在。</p>
        </HelpPopover></div>
        <AgreementContent agreement={agreement} onSelectSource={onSelect} />
        {node.agreementStatus && node.agreementStatus !== 'published' && <p className="mt-2 text-xs text-muted">{node.agreementStatus === 'failed' ? '约定生成失败，等待重试' : '约定尚未发布'}</p>}
      </div>
    </section>
  )
}
