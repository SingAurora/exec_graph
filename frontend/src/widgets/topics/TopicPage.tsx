import { ArrowLeft, ArrowRight, GitBranch, PenLine } from 'lucide-react'
import type { ActionTopic, CompletionNode, PlanNode, Reaction } from '../../entities/action/model/legacy-types'
import type { BranchMode } from '../../entities/action/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { BranchOverview } from '../branches/BranchOverview'
import { CompletionPost } from '../feed/CompletionPost'
import { MarkdownDocument } from '../ai/MarkdownDocument'

type TopicPageProps = {
  topic: ActionTopic
  plans: PlanNode[]
  completions: CompletionNode[]
  users: UserProfile[]
  reactions: Record<string, Reaction>
  onBack: () => void
  onReaction: (id: string, reaction: Exclude<Reaction, null>) => void
  onParallel: (topicId: string) => void
  onContinuePlan: (plan: PlanNode, branchMode: BranchMode) => void
}

export function TopicPage({ topic, plans, completions, users, reactions, onBack, onReaction, onParallel, onContinuePlan }: TopicPageProps) {
  const firstPlan = plans[0]
  const userById = new Map(users.map((user) => [user.id, user]))
  return <section className="max-w-[800px] pt-[38px] max-[700px]:pt-7">
    <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />回到首页</button>
    <header className="border-b border-line py-7 pb-6"><span className="section-kicker">行动主题</span><h2 className="mt-[7px] text-[26px] tracking-[-.04em] max-[700px]:text-[23px]">{topic.title}</h2><p className="mt-[9px] max-w-[650px] text-[13px] leading-[1.7] text-muted">{topic.description}</p><div className="mt-[19px] flex items-center justify-between gap-3 text-xs text-muted max-[700px]:items-start max-[700px]:flex-col"><span>{completions.length} 条完成记录</span><button className="primary-button min-h-[34px] px-[11px] py-[7px] text-xs" type="button" onClick={() => onParallel(topic.id)}><PenLine size={15} />用自己的方式完成</button></div></header>
    <div className="mt-[25px]"><BranchOverview plans={plans} completions={completions} /></div>
    {firstPlan && <details className="mt-[19px] border border-line bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-[18px] px-4 py-3.5 text-xs font-bold text-ink [&::-webkit-details-marker]:hidden"><span>查看一份执行计划</span><span className="font-medium text-muted">{firstPlan.title}</span></summary><MarkdownDocument markdown={firstPlan.markdown} label="执行计划" /></details>}
    <section className="mt-[30px]"><div><span className="section-kicker">继续执行</span><h2 className="mt-[7px] text-[22px] tracking-[-.03em]">从已有节点开始</h2><p className="mt-2 text-xs leading-[1.7] text-muted">沿着当前路径继续，或另开一条方案。完成后的结果会参与主线排序。</p></div><div className="mt-[15px] border-t border-line">{plans.map((plan) => <div className="border-b border-line py-3.5" key={plan.id}><div className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5"><span className="grid size-7 place-items-center rounded-md bg-signal-soft text-signal"><GitBranch size={15} /></span><span className="grid min-w-0 gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{plan.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{plan.status === 'active' ? '计划进行中' : '已有完成记录'}</small></span><span className="text-[10px] font-bold text-signal">{plan.status === 'active' ? '进行中' : '已完成'}</span></div><div className="mt-2 flex items-center gap-3 pl-[39px]"><button className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[10px] font-bold text-signal hover:text-signal-dark" type="button" onClick={() => onContinuePlan(plan, 'continue')}><ArrowRight size={12} />沿此继续</button><button className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[10px] font-semibold text-muted hover:text-signal" type="button" onClick={() => onContinuePlan(plan, 'fork')}><GitBranch size={12} />另开分支</button></div></div>)}</div></section>
    <div className="mt-2">{completions.map((completion) => { const author = userById.get(completion.authorId) ?? users[0]; const plan = plans.find((item) => item.id === completion.planNodeId); return <CompletionPost key={completion.id} completion={completion} author={author} topic={topic} plan={plan} reaction={reactions[completion.id] ?? null} onReaction={onReaction} onOpenTopic={() => undefined} onParallel={onParallel} /> })}</div>
    {!completions.length && <p className="py-[25px] text-[13px] text-muted">还没有完成记录。先用自己的方式开始。</p>}
  </section>
}
