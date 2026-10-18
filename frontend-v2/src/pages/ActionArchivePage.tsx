import { ArrowLeft, MessageCircle, Sparkles } from 'lucide-react'
import type { ActionNode } from '../entities/action/model/types'
import { getActionContextIds, getActionParentIds } from '../entities/action/lib/graph'
import { getActionExpression } from '../entities/action/lib/expressions'
import { ExpressionContent } from '../entities/action/ui/ExpressionContent'
import type { Project, UserProfile } from '../shared/model'
import { MarkdownContent } from '../shared/ui/MarkdownContent'
import { HelpPopover } from '../shared/ui/help/HelpPopover'

/** Shows the factual document, effective expression, and their conversation provenance. */
export function ActionArchivePage({ project, node, actions, users, onBack }: { project: Project; node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onBack: () => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.id === id)).filter((action) => action !== undefined)
  const context = node.contextSnapshot
  return <section className="max-w-[860px] pt-[38px] max-[700px]:pt-7">
    <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16} />回到行动图</button>
    <header className="border-b border-line py-7 pb-6">
      <div className="flex items-center gap-1"><span className="section-kicker">节点 #{node.number} · 形成过程</span><HelpPopover title="形成过程"><p>事实描述本次行动；表达可在本节点更新、沿用承接节点的表达，或主动清空。沿用的表达保留原作者和来源节点。</p><p>展开上下文可查看本节点的直接来源和历史范围；下方保留本节点的 AI 对话。</p></HelpPopover></div>
      <h2 className="mt-[7px] text-[27px] tracking-[-.04em]">{node.title}</h2><p className="mt-2 text-[12px] text-muted">{project.title}</p>
    </header>
    <section className="mt-6 border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4"><Sparkles size={14} className="text-signal" /><h3 className="text-[15px]">事实</h3></div>
      <div className="px-6 py-6 max-[700px]:px-4"><MarkdownContent markdown={node.objectiveMarkdown ?? node.markdown} /></div>
    </section>
    <section className="mt-6 border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4"><Sparkles size={14} className="text-signal" /><h3 className="text-[15px]">表达</h3></div>
      <div className="px-6 py-5 max-[700px]:px-4"><ExpressionContent expression={getActionExpression(actions, node.id)} nodeId={node.id} users={users} /></div>
    </section>
    <details className="mt-6 border border-line bg-surface">
      <summary className="cursor-pointer px-5 py-4 text-[13px] font-semibold text-ink">本次记录使用的上下文</summary>
      <div className="border-t border-line px-5 py-4 text-xs leading-[1.7] text-muted">
        <p>直接承接：{parents.length ? parents.map((parent) => `节点 #${parent.number}`).join('、') : '行动图起点'}</p>
        <p>历史范围：{getActionContextIds(actions, node.id).size - 1} 个节点</p>
        <p>行动图指引：{context?.guide ? '已启用' : '未启用'}</p>
        {context?.guide && <p className="mt-2 border-l-2 border-signal pl-2.5 text-signal-dark">{context.guide}</p>}
      </div>
    </details>
    <section className="mt-6 border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4"><MessageCircle size={14} className="text-signal" /><h3 className="text-[15px]">AI 对话</h3></div>
      <div className="grid gap-3 px-5 py-5">
        {!node.conversation.length && <p className="text-[13px] text-muted">暂无对话记录</p>}
        {node.conversation.map((message) => <div className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`} key={message.id}>
          <div className={`max-w-[78%] border px-3.5 py-3 text-[13px] leading-[1.7] ${message.speaker === 'user' ? 'border-signal bg-signal text-on-signal' : 'border-line bg-paper text-ink'}`}>
            <div className={`mb-1 text-xs font-bold ${message.speaker === 'user' ? 'text-on-signal' : 'text-signal'}`}>{message.speaker === 'user' ? '行动者' : 'ExAct AI'}</div><p>{message.body}</p>
          </div>
        </div>)}
      </div>
    </section>
  </section>
}
