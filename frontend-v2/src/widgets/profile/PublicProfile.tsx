import { Check, UserPlus } from 'lucide-react'
import type { ComponentProps } from 'react'
import { hasUserContributed } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import { Avatar } from '../../shared/ui/Avatar'
import { ActivityFeed } from '../feed/ActivityFeed'

/** Public actions and current expressions of one author, with a functional follow control. */
export function PublicProfile({ profile, currentUserId, following, users, projects, actions, active, activityTabRequest, onToggleFollow, onOpenProject, onOpenNode }: {
  profile: UserProfile; currentUserId: string; following: boolean; users: UserProfile[]
  projects: Project[]; actions: ActionNode[]; active?: boolean
  activityTabRequest?: ComponentProps<typeof ActivityFeed>['tabRequest']
  onToggleFollow: (id: string) => void; onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const authorActions = actions.filter((node) => node.authorId === profile.id)
  const related = projects.filter((project) => project.ownerId === profile.id || hasUserContributed(project.id, profile.id, actions))
  const expressionCount = getPublishedExpressions(actions).filter((node) => node.authorId === profile.id).length
  const self = profile.id === currentUserId
  return <section className="pt-6" aria-label={profile.name + '的主页'}>
    <header>
      <div className="flex items-center gap-4"><Avatar profile={profile} size="large" /><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">{profile.name}</h2>{profile.bio && <p className="mt-1 text-sm leading-6 text-copy">{profile.bio}</p>}</div>
        {self ? <a className="quiet-button" href="#settings">编辑资料</a> : <button className={following ? 'quiet-button' : 'primary-button'} type="button" aria-pressed={following} onClick={() => onToggleFollow(profile.id)}>{following ? <Check size={15} /> : <UserPlus size={15} />}{following ? '已关注' : '关注'}</button>}
      </div>
      <div className="mt-6 flex gap-7 text-sm text-muted"><span><strong className="font-semibold text-ink">{authorActions.length}</strong> 行动</span><span><strong className="font-semibold text-ink">{expressionCount}</strong> 表达</span><span><strong className="font-semibold text-ink">{related.length}</strong> 行动图</span></div>
    </header>
    <ActivityFeed actions={actions} projects={projects} users={users} authorIds={[profile.id]} graphItems={related} active={active} tabRequest={activityTabRequest} onOpenNode={onOpenNode} onOpenProject={onOpenProject} />
  </section>
}
