import { useMemo, type ComponentProps } from 'react'
import { hasUserContributed } from '../../entities/project/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { getProfileAgreementResponses } from '../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Project } from '../../entities/project/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { ProfileCover } from '../../entities/profile/ui/ProfileCover'
import { ProfileBiography } from '../../entities/profile/ui/ProfileBiography'
import { Avatar } from '../../shared/ui/Avatar'
import { ImagePreviewTrigger } from '../../shared/ui/ImagePreviewTrigger'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { ActivityFeed } from '../feed/ActivityFeed'
import { FollowButton } from '../../features/follow/ui/FollowButton'
import { CreateGraphButton } from '../../features/project/ui/CreateGraphButton'
import type { CreateProjectInput } from '../../features/project/model/types'
import { ProfileHome } from './ProfileHome'

/** Public actions, expressions and agreement exchanges of one person, with a follow control. */
export function PublicProfile({ profile, currentUserId, following, users, projects, actions, active, activityTabRequest, onCreateProject, onSetUserFollow, onOpenProject, onOpenNode, onOpenReference }: {
  profile: UserProfile; currentUserId: string; following: boolean; users: UserProfile[]
  projects: Project[]; actions: ActionNode[]; active?: boolean
  activityTabRequest?: ComponentProps<typeof ActivityFeed>['tabRequest']
  onCreateProject?: (input: CreateProjectInput) => void
  onSetUserFollow: (id: string, following: boolean) => boolean | Promise<boolean>; onOpenProject: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
}) {
  const authorActions = actions.filter((node) => node.authorId === profile.id)
  const related = projects.filter((project) => project.ownerId === profile.id || hasUserContributed(project.id, profile.id, actions))
  const expressionCount = getPublishedExpressions(actions).filter((node) => node.authorId === profile.id).length
  const agreementResponses = useMemo(() => getProfileAgreementResponses(getActionReferences(actions), profile.id), [actions, profile.id])
  const self = profile.id === currentUserId
  const avatar = <Avatar profile={profile} size="xlarge" shape="circle" />
  return <section className="pt-6" aria-label={profile.name + '的主页'}>
    <header>
      <ProfileCover image={profile.backgroundImage} size="header" preview />
      <div className="relative -mt-12 flex items-end justify-between gap-4 px-5"><span className="inline-flex shrink-0 rounded-full border-4 border-paper bg-paper">{profile.avatar.trim() ? <ImagePreviewTrigger image={{ url: profile.avatar.trim(), alt: profile.name + '的头像' }} className="inline-flex rounded-full">{avatar}</ImagePreviewTrigger> : avatar}</span>
        {!self && <FollowButton kind="user" name={profile.name} following={following} onChange={(next) => onSetUserFollow(profile.id, next)} />}
      </div>
      <div className="mt-2 grid min-w-0 gap-0.5 px-6">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xl font-semibold" title={profile.name}><span className="min-w-0 truncate">{profile.name}</span><span className="shrink-0"><GenderMark gender={profile.gender} /></span></h2>
        {self && profile.email && <p className="truncate text-sm text-muted" title={profile.email}>{profile.email}</p>}
      </div>
      {profile.bio.trim() && <div className="mt-3 px-5"><ProfileBiography biography={profile.bio} /></div>}
      <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 px-5 text-sm text-muted"><span><strong className="font-semibold text-ink">{expressionCount}</strong> 表达</span><span><strong className="font-semibold text-ink">{agreementResponses.length}</strong> 约定</span><span><strong className="font-semibold text-ink">{authorActions.length}</strong> 行动</span><span><strong className="font-semibold text-ink">{related.length}</strong> 图</span></div>
    </header>
    <ActivityFeed actions={actions} projects={projects} users={users} authorIds={[profile.id]} graphItems={related} agreementResponses={agreementResponses} active={active} tabRequest={activityTabRequest}
      home={(homeActive) => <ProfileHome userId={profile.id} actions={actions} active={homeActive} onOpenNode={onOpenNode} />}
      graphToolbar={self && onCreateProject && <div className="flex items-center justify-between gap-3 pt-4"><a href="#projects" className="text-button text-xs">管理行动图</a><CreateGraphButton onCreate={onCreateProject} compact /></div>}
      onOpenNode={onOpenNode} onOpenProject={onOpenProject} onOpenReference={onOpenReference} />
  </section>
}
