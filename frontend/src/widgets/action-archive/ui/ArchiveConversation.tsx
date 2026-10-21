import { Bot, MessageCircle } from 'lucide-react'
import type { ActionExpressionMessage } from '../../../entities/action/model/types'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'

/** Renders recorded turns without inventing a separate generation history for shared dialogue. */
export function ArchiveConversation({ label, messages, authorId, projectId, users }: {
  label: string
  messages: ActionExpressionMessage[]
  authorId: string
  projectId: string
  users: UserProfile[]
}) {
  return <section className="mt-6" aria-label={label}>
    <h3 className="flex items-center gap-2 text-sm font-medium"><MessageCircle size={16} className="text-muted" />{label}</h3>
    {!messages.length && <p className="py-8 text-sm text-muted">暂无对话记录</p>}
    <div className="mt-5 grid gap-6">
      {messages.map((message) => {
        const participantId = message.authorId ?? authorId
        const participant = users.find((user) => user.id === participantId)
        const participantName = participant?.name ?? participantId
        const participantLink = `#profile?userId=${encodeURIComponent(participantId)}&fromGraph=${encodeURIComponent(projectId)}&fromTab=explore`
        return <article className="flex items-start gap-3" key={message.id}>
          {message.speaker === 'user' ? <ProfilePreview profile={participant} userId={participantId} className="shrink-0 rounded-lg" href={participantLink}><Avatar profile={participant} label={participantName} size="small" /></ProfilePreview>
            : <span className="inline-grid size-8 shrink-0 place-items-center rounded-[9px] bg-signal-soft text-signal" aria-hidden="true"><Bot size={17} /></span>}
          <div className="min-w-0 flex-1">
            {message.speaker === 'user' ? <ProfilePreview profile={participant} userId={participantId} className="inline-block py-1 text-sm font-medium hover:text-signal" href={participantLink}>{participantName}</ProfilePreview> : <span className="inline-block py-1 text-sm font-medium text-muted">引序 AI</span>}
            <div className={`mt-1 rounded-lg px-4 py-3 ${message.speaker === 'user' ? 'bg-soft' : 'bg-surface'}`}><MarkdownContent markdown={message.body} /></div>
          </div>
        </article>
      })}
    </div>
  </section>
}
