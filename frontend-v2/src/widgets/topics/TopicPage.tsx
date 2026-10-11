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
  return <section className="topic-page">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} />回到首页</button>
    <header className="topic-header"><span className="section-kicker">行动主题</span><h2>{topic.title}</h2><p>{topic.description}</p><div className="topic-meta"><span>{completions.length} 条完成记录</span><button className="primary-button compact-button" type="button" onClick={() => onParallel(topic.id)}><PenLine size={15} />用自己的方式完成</button></div></header>
    {firstPlan && <details className="topic-plan"><summary><span>查看一份执行计划</span><span>{firstPlan.title}</span></summary><MarkdownDocument markdown={firstPlan.markdown} label="执行计划" /></details>}
    <div className="topic-feed">{completions.map((completion) => { const author = userById.get(completion.authorId) ?? users[0]; const plan = plans.find((item) => item.id === completion.planNodeId); return <CompletionPost key={completion.id} completion={completion} author={author} topic={topic} plan={plan} reaction={reactions[completion.id] ?? null} onReaction={onReaction} onOpenTopic={() => undefined} onParallel={onParallel} /> })}</div>
    {!completions.length && <p className="empty-state">还没有完成记录。先用自己的方式开始。</p>}
  </section>
}
