import { ChevronDown } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionContextIds } from '../../../entities/action/lib/graph'
import { getActionReferences } from '../../../entities/action/lib/references'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getActionAgreementOrigin } from '../../../entities/action/lib/agreements'
import { AgreementContent } from '../../../entities/action/ui/AgreementContent'

const agreementLabels: Record<ActionReference['agreementStatus'], string> = {
  unrestricted: '未设置约定', satisfied: '满足来源约定', exception: '× 不满足原约定', unreviewed: '尚未记录约定核对结果',
}

/** 展示引用背景、来源约定和已保存的指引；图关系不等同于当时完整的 AI 请求日志。 */
export function ArchiveBackground({ node, actions, onSelectSource }: { node: ActionNode; actions: ActionNode[]; onSelectSource: (id: string) => void }) {
  const graphActions = actions.filter((action) => action.projectId === node.projectId)
  const references = getActionReferences(graphActions).filter((reference) => reference.target.id === node.id)
  const historyIds = getActionContextIds(graphActions, node.id)
  const history = graphActions.filter((action) => action.id !== node.id && historyIds.has(action.id)).sort((a, b) => a.number - b.number)
  const continuation = references.find((reference) => !reference.incorporated)
  const merged = references.filter((reference) => reference.incorporated)

  return (
    <details className="group/background">
      <summary className="grid cursor-pointer list-none grid-cols-[80px_minmax(0,1fr)_16px] items-start gap-x-3 px-4 py-2.5 text-[13px] leading-6 transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
        <span className="text-muted">引用背景</span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          {continuation && <span>承接 #{continuation.source.number}</span>}
          {merged.length > 0 && <span>{merged.length === 1 ? `合入 #${merged[0].source.number}` : `合入 ${merged.length} 个节点`}</span>}
          <span className="text-muted">{history.length ? `历史 ${history.length} 个节点` : '无历史节点'}</span>
        </span>
        <ChevronDown size={15} className="mt-1 text-muted transition-transform group-open/background:rotate-180" />
      </summary>
      <div className="mx-4 border-t border-line pb-4">
        {!references.length && <p className="pt-4 text-sm text-muted">未引用其他节点</p>}
        <div className="divide-y divide-line">
          {references.map((reference) => <section className="py-4" key={reference.id}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="shrink-0 text-xs text-muted">{reference.incorporated ? '合入' : '承接'}</span>
              <button className="border-0 bg-transparent p-0 text-left text-sm text-signal hover:underline" type="button" onClick={() => onSelectSource(reference.source.id)} title={`查看来源节点 #${reference.source.number}的形成过程`}>#{reference.source.number} · {reference.source.title}</button>
            </div>
            <p className={`mt-2 text-xs ${reference.agreementStatus === 'exception' ? 'text-coral' : 'text-muted'}`}>{agreementLabels[reference.agreementStatus]}</p>
            {reference.agreementStatus === 'exception' && <div className="mt-2 space-y-1 text-xs leading-6 text-muted">
              <p>不符合原因：{reference.exceptionReason?.trim() || '尚未填写'}</p>
            </div>}
            {reference.agreement.markdown.trim() && <details className="mt-2">
              <summary className="cursor-pointer text-xs leading-6 text-muted hover:text-signal">来源约定</summary>
              <div className="mt-2 rounded-md bg-surface/70 px-3 py-2"><AgreementContent agreement={reference.agreement} origin={getActionAgreementOrigin(graphActions, reference.source.id)} onSelectSource={onSelectSource} /></div>
            </details>}
          </section>)}
        </div>
        {history.length > 0 && <details className="mt-1">
          <summary className="cursor-pointer text-xs leading-6 text-muted hover:text-signal">查看历史节点（{history.length}）</summary>
          <div className="mt-2 grid max-h-60 gap-2 overflow-y-auto overscroll-contain rounded-md bg-surface/70 p-3">
            {history.map((source) => <button className="border-0 bg-transparent p-0 text-left text-xs leading-6 text-muted hover:text-signal" type="button" key={source.id} onClick={() => onSelectSource(source.id)}>#{source.number} · {source.title}</button>)}
          </div>
        </details>}
        {node.contextSnapshot?.guide && <details className="mt-3">
          <summary className="cursor-pointer text-xs leading-6 text-muted hover:text-signal">记录时的 AI 指引</summary>
          <p className="mt-2 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm leading-[1.85] text-copy">{node.contextSnapshot.guide}</p>
        </details>}
      </div>
    </details>
  )
}
