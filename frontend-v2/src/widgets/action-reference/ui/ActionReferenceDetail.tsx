import { ArrowUpRight, GitMerge, Link2 } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { getActionContextIds } from '../../../entities/action/lib/graph'
import { getActionLevels } from '../../../entities/action/lib/levels'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'

type Props = {
  reference: ActionReference
  actions: ActionNode[]
  users: UserProfile[]
  onSelectNode: (id: string) => void
}

const agreementLabels: Record<ActionReference['agreementStatus'], string> = {
  unrestricted: '来源未设置约定',
  satisfied: '满足来源约定',
  exception: '不满足原约定',
  unreviewed: '尚未记录约定核对结果',
}

/** Shows the selected reference, its source agreement and any exception authorization. */
export function ActionReferenceDetail({ reference, actions, users, onSelectNode }: Props) {
  const { source, target, incorporated, agreementStatus, authorization } = reference
  const levels = getActionLevels(actions)
  const userById = new Map(users.map((user) => [user.id, user]))
  const historyCount = getActionContextIds(actions, source.id).size
  const exception = agreementStatus === 'exception'
  const sourceAuthor = userById.get(source.authorId)?.name ?? source.authorId

  return <article>
    <header className="border-b border-line px-6 py-[19px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1"><span className="section-kicker">引用关系</span><HelpPopover title="引用关系">
          <p>实线表示同一作者的引用，虚线表示不同作者的引用。承接延续当前路线，合入将另一来源纳入行动背景。</p>
          <p>来源约定适用于这条引用。不满足约定时显示 ×；自己引用自己可自动同意例外，引用他人则需来源作者同意。获得授权后仍保留 ×。</p>
          <p>未记录约定核对结果时，不能据此判断是否满足约定。</p>
          <p>引用背景包含来源节点及其全部引用历史，追溯至起点并去重。未被引用的其他分支不属于当前已知的执行事实。</p>
        </HelpPopover></div>
        <span className="text-xs text-muted">节点 #{source.number} → #{target.number}</span>
      </div>
      <h3 className="mt-[7px] flex items-center gap-2 text-xl tracking-[-.03em]">
        {incorporated ? <GitMerge size={20} className="text-signal" /> : <Link2 size={20} className="text-signal" />}
        {incorporated ? '合入行动背景' : '承接行动'}
      </h3>
    </header>

    <section className="border-b border-line px-6 py-5" aria-label="引用双方">
      <ReferenceNode label="被引用的来源" node={source} author={userById.get(source.authorId)} level={levels.get(source.id)} onSelect={onSelectNode} />
      <div className="my-2 ml-4 h-5 border-l border-line" aria-hidden="true" />
      <ReferenceNode label="引用该来源的行动" node={target} author={userById.get(target.authorId)} level={levels.get(target.id)} onSelect={onSelectNode} />
    </section>

    <section className="border-b border-line px-6 py-5">
      <h4 className="text-[13px] font-semibold">来源约定</h4>
      <div className="mt-3">
        {source.agreementMarkdown?.trim() ? <MarkdownContent markdown={source.agreementMarkdown} />
          : <p className="text-xs leading-[1.8] text-muted">未设置</p>}
      </div>
    </section>

    <section className="border-b border-line px-6 py-5">
      <h4 className="text-[13px] font-semibold">约定核对</h4>
      <p className={`mt-3 text-[13px] font-semibold ${exception ? 'text-coral' : agreementStatus === 'satisfied' ? 'text-signal' : 'text-muted'}`}>
        {exception && <span aria-hidden="true">× </span>}{agreementLabels[agreementStatus]}
      </p>
      {exception && <>
        <h5 className="mt-4 text-xs font-semibold text-muted">例外原因</h5>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-[1.9]">{reference.exceptionReason?.trim() || '尚未填写例外原因。'}</p>
        <div className="mt-4 border-l-2 border-line pl-3">
          <h5 className="text-xs font-semibold text-muted">例外授权</h5>
          <p className="mt-1.5 text-xs leading-[1.9]">
            {authorization === 'self-approved' ? '自动同意（本人）'
              : authorization === 'author-approved' ? `${sourceAuthor} 已同意`
                : `等待 ${sourceAuthor} 同意`}
          </p>
        </div>
      </>}
    </section>

    <section className="px-6 py-5">
      <h4 className="text-[13px] font-semibold">引用背景</h4>
      <p className="mt-2 text-xs leading-[1.9] text-muted">{historyCount} 个行动节点</p>
    </section>
  </article>
}

function ReferenceNode({ label, node, author, level, onSelect }: {
  label: string
  node: ActionNode
  author?: UserProfile
  level?: number
  onSelect: (id: string) => void
}) {
  return <div>
    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
      <span>{label}</span><span>第 {level} 层 · 节点 #{node.number}</span>
    </div>
    <button className="group flex w-full items-center gap-3 rounded-md border border-line bg-transparent p-3 text-left hover:bg-soft" type="button" onClick={() => onSelect(node.id)}>
      <Avatar profile={author} label={author?.name.slice(0, 1) ?? node.authorId.slice(0, 1)} size="small" />
      <span className="min-w-0 flex-1"><strong className="block text-sm leading-[1.7] group-hover:text-signal">{node.title}</strong><span className="mt-1 block text-[13px] font-medium text-ink">{author?.name ?? node.authorId}</span></span>
      <ArrowUpRight size={15} className="shrink-0 text-muted group-hover:text-signal" />
    </button>
  </div>
}
