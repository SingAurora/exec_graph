import { ArrowUpRight, GitMerge, Link2 } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getActionContextIds } from '../../../entities/action/lib/graph'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { getActionAgreementOrigin } from '../../../entities/action/lib/agreements'
import { AgreementContent } from '../../../entities/action/ui/AgreementContent'
import type { UserProfile } from '../../../entities/profile/model/types'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { DetailPanelControls } from '../../../shared/ui/DetailPanelControls'

type Props = {
  reference: ActionReference
  actions: ActionNode[]
  users: UserProfile[]
  onSelectNode: (id: string) => void
  onHide: () => void
}

const agreementLabels: Record<ActionReference['agreementStatus'], string> = {
  unrestricted: '来源未设置约定',
  satisfied: '满足来源约定',
  exception: '不满足原约定',
  unreviewed: '尚未记录约定核对结果',
}

/** 选中箭头的详情：展示引用双方、来源有效约定、核对状态和不满足原因，不设审批流程。 */
export function ActionReferenceDetail({ reference, actions, users, onSelectNode, onHide }: Props) {
  const { source, target, incorporated, agreementStatus } = reference
  const levels = getActionLevels(actions)
  const userById = new Map(users.map((user) => [user.id, user]))
  const historyCount = getActionContextIds(actions, source.id).size
  const exception = agreementStatus === 'exception'

  return (
    <article>
      <header className="px-6 pb-2 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1"><span className="text-xs text-muted">引用关系</span><HelpPopover title="引用关系">
            <p>实线表示同一作者的引用，虚线表示不同作者的引用。承接延续当前路线，合入将另一来源纳入行动背景。</p>
            <p>来源约定适用于这条引用。不满足约定时，连线上显示 × 并记录原因，仍可引用。</p>
            <p>未记录约定核对结果时，不能据此判断是否满足约定。</p>
            <p>引用历史包含来源节点本身及其全部上游引用节点，追溯至起点并去重，不包含当前引用行动。未被引用的其他分支不属于当前已知的执行事实。</p>
          </HelpPopover></div>
          <div className="flex items-center gap-3"><span className="text-xs text-muted">节点 #{source.number} → #{target.number}</span><DetailPanelControls onHide={onHide} /></div>
        </div>
        <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold leading-[1.55] tracking-[-.02em]">
          {incorporated ? <GitMerge size={20} className="text-signal" /> : <Link2 size={20} className="text-signal" />}
          {incorporated ? '合入行动背景' : '承接行动'}
        </h3>
      </header>

      <section className="px-6 py-4">
        <ReferenceNode label="来源" node={source} author={userById.get(source.authorId)} level={levels.get(source.id)} onSelect={onSelectNode} />
        <div className="my-2 ml-4 h-5 border-l border-line" />
        <ReferenceNode label="引用行动" node={target} author={userById.get(target.authorId)} level={levels.get(target.id)} onSelect={onSelectNode} />
      </section>

      <section className="action-reading-document px-6 py-4">
        <h4 className="text-sm font-medium">来源约定</h4>
        <div className="mt-3">
          <AgreementContent agreement={reference.agreement} origin={getActionAgreementOrigin(actions, source.id)} onSelectSource={onSelectNode} />
        </div>
      </section>

      <section className="px-6 py-4">
        <h4 className="text-sm font-medium">约定核对</h4>
        <p className={`mt-3 text-sm ${exception ? 'text-coral' : agreementStatus === 'satisfied' ? 'text-signal' : 'text-muted'}`}>
          {exception && <span>× </span>}{agreementLabels[agreementStatus]}
        </p>
        {exception && <>
          <h5 className="mt-4 text-xs font-semibold text-muted">不符合原因</h5>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-[1.85] text-copy">{reference.exceptionReason?.trim() || '尚未填写不符合原因。'}</p>
        </>}
      </section>

      <section className="px-6 pb-6 pt-4">
        <h4 className="text-sm font-medium">引用历史</h4>
        <p className="mt-2 text-sm text-muted">共 {historyCount} 个节点</p>
      </section>
    </article>
  )
}

function ReferenceNode({ label, node, author, level, onSelect }: {
  label: string
  node: ActionNode
  author?: UserProfile
  level?: number
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{label}</span><span>第 {level} 层 · 节点 #{node.number}</span>
      </div>
      <div className="flex w-full items-center gap-3 rounded-md bg-soft p-3">
        <ProfilePreview profile={author} userId={node.authorId} className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-signal"><Avatar profile={author} label={author?.name ?? node.authorId} size="small" /></ProfilePreview>
        <button className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm border-0 bg-transparent p-0 text-left hover:text-signal" type="button" onClick={() => onSelect(node.id)}>
          <span className="min-w-0 flex-1"><strong className="block text-sm font-medium leading-[1.7] group-hover:text-signal">{node.title}</strong><span className="mt-1 block text-sm text-muted">{author?.name ?? node.authorId}</span></span>
          <ArrowUpRight size={15} className="shrink-0 text-muted group-hover:text-signal" />
        </button>
      </div>
    </div>
  )
}
