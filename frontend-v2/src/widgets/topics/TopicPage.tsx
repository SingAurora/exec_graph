import { ArrowLeft, PenLine } from 'lucide-react'
import type { ActionTopic, CompletionNode, PlanNode, Reaction, UserProfile } from '../../shared/model'
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
}

export function TopicPage({ topic, plans, completions, users, reactions, onBack, onReaction, onParallel }: TopicPageProps) {
  const firstPlan = plans[0]
  const userById = new Map(users.map((user) => [user.id, user]))
  return <section className="max-w-[800px] pt-[38px] max-[700px]:pt-7">
    <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />回到首页</button>
    <header className="border-b border-line py-7 pb-6"><span className="section-kicker">行动主题</span><h2 className="mt-[7px] text-[26px] tracking-[-.04em] max-[700px]:text-[23px]">{topic.title}</h2><p className="mt-[9px] max-w-[650px] text-[13px] leading-[1.7] text-muted">{topic.description}</p><div className="mt-[19px] flex items-center justify-between gap-3 text-xs text-muted max-[700px]:items-start max-[700px]:flex-col"><span>{completions.length} 条完成记录</span><button className="primary-button min-h-[34px] px-[11px] py-[7px] text-xs" type="button" onClick={() => onParallel(topic.id)}><PenLine size={15} />用自己的方式完成</button></div></header>
    {firstPlan && <details className="mt-[19px] border border-line bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-[18px] px-4 py-3.5 text-xs font-bold text-ink [&::-webkit-details-marker]:hidden"><span>查看一份执行计划</span><span className="font-medium text-muted">{firstPlan.title}</span></summary><MarkdownDocument markdown={firstPlan.markdown} label="执行计划" /></details>}
    <div className="mt-2">{completions.map((completion) => { const author = userById.get(completion.authorId) ?? users[0]; const plan = plans.find((item) => item.id === completion.planNodeId); return <CompletionPost key={completion.id} completion={completion} author={author} topic={topic} plan={plan} reaction={reactions[completion.id] ?? null} onReaction={onReaction} onOpenTopic={() => undefined} onParallel={onParallel} /> })}</div>
    {!completions.length && <p className="py-[25px] text-[13px] text-muted">还没有完成记录。先用自己的方式开始。</p>}
  </section>
}
