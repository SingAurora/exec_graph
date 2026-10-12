import type { ActionTopic, CompletionNode, PlanNode, Reaction, UserProfile } from '../shared/model'
import { CompletionPost } from '../widgets/feed/CompletionPost'

type FeedPageProps = {
  title: string
  eyebrow: string
  completions: CompletionNode[]
  topics: ActionTopic[]
  plans: PlanNode[]
  users: UserProfile[]
  reactions: Record<string, Reaction>
  onReaction: (id: string, reaction: Exclude<Reaction, null>) => void
  onOpenTopic: (topicId: string) => void
  onParallel: (topicId: string) => void
}

export function FeedPage({ title, eyebrow, completions, topics, plans, users, reactions, onReaction, onOpenTopic, onParallel }: FeedPageProps) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const userById = new Map(users.map((user) => [user.id, user]))
  return <section className="pt-[38px] max-[700px]:pt-7"><div className="pb-[22px]"><span className="section-kicker">{eyebrow}</span><h2 className="mt-[7px] text-[25px] tracking-[-.03em] max-[700px]:text-[22px]">{title}</h2><p className="mt-2 text-sm leading-[1.7] text-muted">先看看别人留下的完成记录，再决定自己要不要开始。</p></div><div className="border-t border-line">{completions.map((completion) => { const topic = topicById.get(completion.topicId); const author = userById.get(completion.authorId); if (!topic || !author) return null; return <CompletionPost key={completion.id} completion={completion} author={author} topic={topic} plan={plans.find((plan) => plan.id === completion.planNodeId)} reaction={reactions[completion.id] ?? null} onReaction={onReaction} onOpenTopic={onOpenTopic} onParallel={onParallel} /> })}</div>{!completions.length && <p className="py-[25px] text-[13px] text-muted">这里还没有完成记录。</p>}</section>
}
