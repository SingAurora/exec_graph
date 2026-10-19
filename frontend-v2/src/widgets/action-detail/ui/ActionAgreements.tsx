import { ChevronDown, FilePlus2, Pencil, ScrollText } from 'lucide-react'
import { useId, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionSourceAgreements, getUnreviewedAgreementCount } from '../../../entities/action/lib/references'
import { canEditActionAgreement, getActionAgreement, getActionAgreementOrigin } from '../../../entities/action/lib/agreements'
import { AgreementContent } from '../../../entities/action/ui/AgreementContent'
import type { UserProfile } from '../../../shared/model'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { EditAgreement } from '../../../features/action-agreement/ui/EditAgreement'

/** Summarizes every direct source agreement independently of the node's own downstream agreement. */
export function ActionSourceAgreements({ node, actions, users, onSelect }: { node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onSelect: (id: string) => void }) {
  const references = getActionSourceAgreements(actions, node.id)
  if (!references.length) return null
  const unreviewed = getUnreviewedAgreementCount(references)
  return <details key={node.id} className="group/agreements rounded-lg border border-line bg-soft/40" aria-label="来源约定">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs leading-5 [&::-webkit-details-marker]:hidden">
      <ScrollText size={14} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="font-medium">来源约定 <span className="ml-1 font-normal tabular-nums text-muted">{references.length}</span></span>
      {unreviewed > 0 && <span className="text-coral">· 待核对 {unreviewed}</span>}
      <ChevronDown size={14} className="ml-auto shrink-0 text-muted transition-transform group-open/agreements:rotate-180" aria-hidden="true" />
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
        return <section className="py-3" key={reference.id} aria-label={`节点 #${reference.source.number}的来源约定`}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-5">
            <button className="border-0 bg-transparent p-0 text-xs text-signal hover:underline" type="button" title={reference.source.title} aria-label={`查看约定来源节点 #${reference.source.number}`} onClick={() => onSelect(reference.source.id)}>{reference.incorporated ? '合入' : '承接'} #{reference.source.number}</button>
            <span className="text-muted">{sourceAuthor}</span>
          </div>
          <p className={`mt-1.5 text-xs leading-5 ${exception ? 'text-coral' : reference.agreementStatus === 'satisfied' ? 'text-signal' : 'text-muted'}`}>
            {exception ? '× 不满足约定' : reference.agreementStatus === 'satisfied' ? '满足约定' : '尚未核对'}
          </p>
          {exception && <p className="mt-1.5 whitespace-pre-wrap text-xs leading-[1.8] text-muted">不符合原因：{reference.exceptionReason?.trim() || '尚未填写'}</p>}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs leading-5 text-muted hover:text-signal">查看约定</summary>
            <div className="mt-2 border-l-2 border-line pl-3"><AgreementContent agreement={reference.agreement} origin={getActionAgreementOrigin(actions, reference.source.id)} onSelectSource={onSelect} /></div>
          </details>
        </section>
      })}</div>
    </div>
  </details>
}

/** Shows conditions this node sets for future references, separately from its incoming obligations. */
export function ActionOwnAgreement({ node, actions, onSelect, onUpdate }: { node: ActionNode; actions: ActionNode[]; onSelect: (id: string) => void; onUpdate?: (markdown: string) => boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const contentId = useId()
  const formId = useId()
  const agreement = getActionAgreement(actions, node.id)
  const canEdit = Boolean(onUpdate) && canEditActionAgreement(actions, node.id)
  const hasContent = Boolean(agreement.markdown.trim())
  const EditIcon = hasContent ? Pencil : FilePlus2
  return <section className="rounded-lg border border-line bg-soft/40" aria-label="本节点约定">
    <div className="flex items-center gap-3 px-3">
      <button className="flex min-h-10 min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left text-xs leading-5 hover:text-signal" type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)}><ScrollText size={14} className="shrink-0 text-muted" aria-hidden="true" /><span className="font-medium">约定</span>{!agreement.markdown.trim() && <span className="text-muted">无约定</span>}<ChevronDown size={14} className={`ml-auto shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
      {canEdit && <button className="inline-flex min-h-8 shrink-0 items-center gap-1.5 border-0 bg-transparent px-0 text-xs font-medium text-muted hover:text-signal" type="button" aria-expanded={editing} aria-controls={editing ? formId : undefined} onClick={() => setEditing((value) => !value)}><EditIcon size={14} aria-hidden="true" />{hasContent ? '修改约定' : '补充约定'}</button>}
    </div>
    <div id={contentId} hidden={!expanded} className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>后续引用采用的约定</span><HelpPopover title="约定的继承">
        <p>默认沿承接关系继承，修改后从本节点向后生效；清空后，后续未修改时也无约定。合入来源的约定分别核对，不自动拼接。</p>
        <p>设置后续约定与遵守来源约定是两件事，新版本不会改写历史核对结果。</p>
      </HelpPopover></div>
      <AgreementContent agreement={agreement} origin={getActionAgreementOrigin(actions, node.id)} onSelectSource={onSelect} />
    </div>
    {canEdit && editing && onUpdate && <div id={formId}><EditAgreement markdown={agreement.markdown} onSave={onUpdate} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setExpanded(true) }} /></div>}
  </section>
}
