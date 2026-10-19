import { useMemo, type ComponentProps } from 'react'
import { hasUserContributed } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { getProfileAgreementResponses } from '../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import { ProfileCover } from '../../entities/profile/ui/ProfileCover'
import { Avatar } from '../../shared/ui/Avatar'
import { ActivityFeed } from '../feed/ActivityFeed'
import { FollowButton } from '../../features/follow/ui/FollowButton'

/** Public actions, expressions and agreement exchanges of one person, with a follow control. */
export function PublicProfile({ profile, currentUserId, following, users, projects, actions, active, activityTabRequest, onSetUserFollow, onOpenProject, onOpenNode, onOpenReference }: {
  profile: UserProfile; currentUserId: string; following: boolean; users: UserProfile[]
  projects: Project[]; actions: ActionNode[]; active?: boolean
  activityTabRequest?: ComponentProps<typeof ActivityFeed>['tabRequest']
  onSetUserFollow: (id: string, following: boolean) => boolean; onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
}) {
  const authorActions = actions.filter((node) => node.authorId === profile.id)
  const related = projects.filter((project) => project.ownerId === profile.id || hasUserContributed(project.id, profile.id, actions))
  const expressionCount = getPublishedExpressions(actions).filter((node) => node.authorId === profile.id).length
  const agreementResponses = useMemo(() => getProfileAgreementResponses(getActionReferences(actions), profile.id), [actions, profile.id])
  const self = profile.id === currentUserId
  return <section className="pt-6" aria-label={profile.name + '的主页'}>
    <header>
      <ProfileCover image={profile.backgroundImage} size="header" />
      <div className="relative -mt-9 flex items-end gap-4 px-5"><span className="inline-flex shrink-0 rounded-full border-4 border-paper bg-paper"><Avatar profile={profile} size="large" shape="circle" /></span><div className="min-w-0 flex-1 pt-12"><h2 className="text-xl font-semibold">{profile.name}</h2></div>
        {self ? <a className="quiet-button" href="#settings">编辑资料</a> : <FollowButton kind="user" name={profile.name} following={following} onChange={(next) => onSetUserFollow(profile.id, next)} />}
      </div>
      {profile.bio && <p className="mt-3 px-5 text-sm leading-6 text-copy">{profile.bio}</p>}
      <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 px-5 text-sm text-muted"><span><strong className="font-semibold text-ink">{authorActions.length}</strong> 行动</span><span><strong className="font-semibold text-ink">{expressionCount}</strong> 表达</span><span><strong className="font-semibold text-ink">{agreementResponses.length}</strong> 约定</span><span><strong className="font-semibold text-ink">{related.length}</strong> 行动图</span></div>
    </header>
    <ActivityFeed actions={actions} projects={projects} users={users} authorIds={[profile.id]} graphItems={related} agreementResponses={agreementResponses} active={active} tabRequest={activityTabRequest} onOpenNode={onOpenNode} onOpenProject={onOpenProject} onOpenReference={onOpenReference} />
  </section>
}
