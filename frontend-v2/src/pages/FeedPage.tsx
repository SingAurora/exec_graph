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
  return <section className="feed-page"><div className="feed-intro"><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>先看看别人留下的完成记录，再决定自己要不要开始。</p></div><div className="completion-feed">{completions.map((completion) => { const topic = topicById.get(completion.topicId); const author = userById.get(completion.authorId); if (!topic || !author) return null; return <CompletionPost key={completion.id} completion={completion} author={author} topic={topic} plan={plans.find((plan) => plan.id === completion.planNodeId)} reaction={reactions[completion.id] ?? null} onReaction={onReaction} onOpenTopic={onOpenTopic} onParallel={onParallel} /> })}</div>{!completions.length && <p className="empty-state">这里还没有完成记录。</p>}</section>
}
