import { ArrowRight, Check, CircleHelp, FileText } from 'lucide-react'
import type { ActionTopic, CompletionNode, PlanNode, Reaction, UserProfile } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type CompletionPostProps = {
  completion: CompletionNode
  author: UserProfile
  topic: ActionTopic
  plan?: PlanNode
  reaction: Reaction
  onReaction: (id: string, reaction: Exclude<Reaction, null>) => void
  onOpenTopic: (topicId: string) => void
  onParallel: (topicId: string) => void
}

function summaryFromMarkdown(markdown: string) {
  const lines = markdown.split('\n').filter((line) => line.trim() && !line.startsWith('#'))
  return lines.slice(0, 3).join(' ')
}

export function CompletionPost({ completion, author, topic, plan, reaction, onReaction, onOpenTopic, onParallel }: CompletionPostProps) {
  return <article className="completion-post">
    <div className="post-author"><Avatar profile={author} size="medium" /><div><strong>{author.name}</strong><span>{completion.createdAt}</span></div></div>
    <button className="post-title-link" type="button" onClick={() => onOpenTopic(topic.id)}><h2>{completion.title}</h2><ArrowRight size={16} aria-hidden="true" /></button>
    <button className="post-topic" type="button" onClick={() => onOpenTopic(topic.id)}>{topic.title}</button>
    <p className="post-summary">{summaryFromMarkdown(completion.markdown)}</p>
    <div className="post-actions"><button className={`reaction-button ${reaction === 'believe' ? 'is-selected' : ''}`} type="button" onClick={() => onReaction(completion.id, 'believe')}><Check size={15} />相信 {completion.believeCount}</button><button className={`reaction-button ${reaction === 'doubt' ? 'is-selected is-doubt' : ''}`} type="button" onClick={() => onReaction(completion.id, 'doubt')}><CircleHelp size={15} />存疑 {completion.doubtCount}</button><button className="post-secondary-action" type="button" onClick={() => onOpenTopic(topic.id)}><FileText size={15} />查看计划</button><button className="post-secondary-action post-parallel" type="button" onClick={() => onParallel(topic.id)}>用自己的方式完成</button></div>
    {plan && <div className="post-footnote">这条完成记录来自一个计划节点</div>}
  </article>
}
