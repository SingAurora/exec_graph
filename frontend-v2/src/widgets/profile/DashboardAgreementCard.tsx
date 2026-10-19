import { getReferenceAgreementAuthorId } from '../../entities/action/lib/agreement-responses'
import type { ActionReference } from '../../entities/action/lib/references'
import type { Project, UserProfile } from '../../shared/model'
import { formatFullPublicationTime, formatPublicationTime } from '../../shared/lib/date'
import { getMarkdownSummary } from '../../shared/lib/markdownSummary'
import { Avatar } from '../../shared/ui/Avatar'

/** Compact exchange preview that opens its real arrow while keeping profile links independent. */
export function DashboardAgreementCard({ reference, users, currentUserId, project, onOpenReference, onOpenProject }: {
  reference: ActionReference; users: UserProfile[]; currentUserId: string; project?: Project
  onOpenReference: (reference: ActionReference) => void; onOpenProject: (id: string) => void
}) {
  return <article className="group relative isolate min-w-0 rounded-md" data-reference-id={reference.id}>
    <button className="absolute inset-0 z-0 rounded-md border-0 bg-transparent p-0 transition hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={`查看约定回应：节点 #${reference.source.number} → #${reference.target.number}`} onClick={() => onOpenReference(reference)} />
    <div className="pointer-events-none relative">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-5">
        <ProfileLink id={reference.target.authorId} users={users} currentUserId={currentUserId} />
        <span className="text-muted">满足了</span>
        <ProfileLink id={getReferenceAgreementAuthorId(reference)} users={users} currentUserId={currentUserId} />
      </div>
      <blockquote className="mt-2 border-l-2 border-line pl-2.5"><p className="line-clamp-2 text-xs leading-6 text-copy">{getMarkdownSummary(reference.agreement.markdown)}</p></blockquote>
      <div className={`mt-1.5 grid min-w-0 items-center gap-x-2 text-[11px] leading-5 text-muted ${project ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        <time className="pointer-events-auto cursor-text" dateTime={reference.target.createdAt} title={formatFullPublicationTime(reference.target.createdAt)}>{formatPublicationTime(reference.target.createdAt)}</time>
        {project && <button className="pointer-events-auto relative z-10 min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-left text-[11px] leading-5 text-muted hover:text-signal" type="button" title={project.title} onClick={() => onOpenProject(project.id)}>{project.title}</button>}
      </div>
    </div>
  </article>
}

function ProfileLink({ id, users, currentUserId }: { id: string; users: UserProfile[]; currentUserId: string }) {
  const user = users.find((item) => item.id === id)
  const name = user?.name ?? id
  return <a className="pointer-events-auto relative z-10 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm text-ink hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(id)}`} aria-label={`查看${name}的主页`} title={name}>
    <Avatar profile={user} label={name} size="tiny" /><span className="max-w-20 truncate">{id === currentUserId ? '我' : name}</span>
  </a>
}
