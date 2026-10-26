import { ArrowRight, Check, CircleHelp, FileText } from 'lucide-react'
import type { ActionTopic, CompletionNode, PlanNode, Reaction } from '../../entities/action/model/legacy-types'
import type { UserProfile } from '../../entities/profile/model/types'
import { Avatar } from '../../shared/ui/Avatar'
import { PostImageGallery } from '../post/PostImageGallery'

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
  return (
    <article className="border-b border-line py-[25px]">
      <div className="flex items-center gap-2.5"><Avatar profile={author} size="medium" /><div className="grid gap-[3px]"><strong className="text-[13px]">{author.name}</strong><span className="text-[11px] text-muted">{completion.createdAt}</span></div></div>
      <button className="mt-[17px] flex w-full items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-ink hover:text-signal [&_h2]:hover:text-signal" type="button" onClick={() => onOpenTopic(topic.id)}><h2 className="text-lg tracking-[-.02em] max-[700px]:text-[17px]">{completion.title}</h2><ArrowRight className="flex-none text-signal" size={16} /></button>
      <button className="mt-2 border-0 bg-transparent p-0 text-left text-xs font-bold text-signal" type="button" onClick={() => onOpenTopic(topic.id)}>{topic.title}</button>
      <p className="mt-2.5 max-w-[720px] text-sm leading-[1.8] text-muted">{summaryFromMarkdown(completion.markdown)}</p>
      <PostImageGallery images={completion.images} />
      <div className="mt-[18px] flex flex-wrap items-center gap-[9px] max-[700px]:gap-1.5"><button className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border border-line bg-surface px-[9px] py-[5px] text-[11px] font-bold text-muted transition hover:border-signal hover:text-signal ${reaction === 'believe' ? 'border-signal text-signal' : ''}`} type="button" onClick={() => onReaction(completion.id, 'believe')}><Check size={15} />相信 {completion.believeCount}</button><button className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border border-line bg-surface px-[9px] py-[5px] text-[11px] font-bold text-muted transition hover:border-signal hover:text-signal ${reaction === 'doubt' ? 'border-coral text-coral' : ''}`} type="button" onClick={() => onReaction(completion.id, 'doubt')}><CircleHelp size={15} />存疑 {completion.doubtCount}</button><button className="inline-flex items-center gap-1.5 border-0 bg-transparent px-1 py-2 text-[11px] font-semibold text-muted hover:text-signal" type="button" onClick={() => onOpenTopic(topic.id)}><FileText size={15} />查看计划</button><button className="ml-auto inline-flex items-center gap-1.5 border-0 bg-transparent px-1 py-2 text-xs font-semibold text-signal max-[700px]:ml-0 max-[700px]:w-full" type="button" onClick={() => onParallel(topic.id)}>用自己的方式完成</button></div>
      {plan && <div className="mt-3.5 text-[11px] text-muted">这条完成记录来自一个计划节点</div>}
    </article>
  )
}
