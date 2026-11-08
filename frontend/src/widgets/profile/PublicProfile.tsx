import { useMemo, type ComponentProps } from 'react'
import { hasUserContributed } from '../../entities/graph/lib/activity'
import { getPublishedExpressions } from '../../entities/action/lib/published'
import { getProfileAgreementResponses } from '../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import type { Graph } from '../../entities/graph/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { ProfileCover } from '../../entities/profile/ui/ProfileCover'
import { ProfileBiography } from '../../entities/profile/ui/ProfileBiography'
import { formatMainlandLocation } from '../../entities/profile/model/mainland-regions'
import { Avatar } from '../../shared/ui/Avatar'
import { ImagePreviewTrigger } from '../../shared/ui/ImagePreviewTrigger'
import { GenderMark } from '../../shared/ui/profile/GenderMark'
import { ActivityFeed } from '../feed/ActivityFeed'
import { FollowButton } from '../../features/follow/ui/FollowButton'
import { CreateGraphButton } from '../../features/graph/ui/CreateGraphButton'
import type { CreateGraphInput } from '../../features/graph/model/types'
import { ProfileHome } from './ProfileHome'
import { ProfileHighlights } from './ProfileHighlights'

/** 本人与他人共用的公开主页，组织热力图、表达、约定回应、行动和图等栏目。 */
export function PublicProfile({ profile, currentUserUuid, following, users, graphs, actions, active, activityTabRequest, onCreateGraph, onSetUserFollow, onOpenGraph, onOpenNode, onOpenReference }: {
  profile: UserProfile; currentUserUuid: string; following: boolean; users: UserProfile[]
  graphs: Graph[]; actions: ActionNode[]; active?: boolean
  activityTabRequest?: ComponentProps<typeof ActivityFeed>['tabRequest']
  onCreateGraph?: (input: CreateGraphInput) => void
  onSetUserFollow: (id: string, following: boolean) => boolean | Promise<boolean>; onOpenGraph: (id: string) => void
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference: (reference: ActionReference) => void
}) {
  const authorActions = actions.filter((node) => node.authorUuid === profile.uuid)
  const related = graphs.filter((graph) => graph.ownerUuid === profile.uuid || hasUserContributed(graph.uuid, profile.uuid, actions))
  const expressionCount = getPublishedExpressions(actions).filter((node) => node.authorUuid === profile.uuid).length
  const agreementResponses = useMemo(() => getProfileAgreementResponses(getActionReferences(actions), profile.uuid), [actions, profile.uuid])
  const self = profile.uuid === currentUserUuid
  const avatar = <Avatar profile={profile} size="xlarge" shape="circle" />
  return (
    <section className="pt-6">
      <header>
        <ProfileCover image={profile.backgroundImage} size="header" preview />
        <div className="relative -mt-12 flex items-end justify-between gap-4 px-5"><span className="inline-flex shrink-0 rounded-full border-4 border-paper bg-paper">{profile.avatar.trim() ? <ImagePreviewTrigger image={{ url: profile.avatar.trim(), alt: profile.name + '的头像' }} className="inline-flex rounded-full">{avatar}</ImagePreviewTrigger> : avatar}</span>
          {!self && <FollowButton kind="user" name={profile.name} following={following} onChange={(next) => onSetUserFollow(profile.uuid, next)} />}
        </div>
        <div className="mt-2 grid min-w-0 gap-0.5 px-6">
          <h2 className="flex min-w-0 items-center gap-1.5 text-xl font-semibold" title={profile.name}><span className="min-w-0 truncate">{profile.name}</span><span className="shrink-0"><GenderMark gender={profile.gender} /></span></h2>
          {profile.location && <p className="text-sm text-muted">{formatMainlandLocation(profile.location.code)}</p>}
        </div>
        <div className="mt-3 px-5"><ProfileBiography biography={profile.bio} /></div>
        <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 px-5 text-sm text-muted"><span><strong className="font-semibold text-ink">{expressionCount}</strong> 表达</span><span><strong className="font-semibold text-ink">{agreementResponses.length}</strong> 约定</span><span><strong className="font-semibold text-ink">{authorActions.length}</strong> 行动</span><span><strong className="font-semibold text-ink">{related.length}</strong> 图</span></div>
      </header>
      <ActivityFeed actions={actions} graphs={graphs} users={users} authorUuids={[profile.uuid]} graphItems={related} agreementResponses={agreementResponses} active={active} tabRequest={activityTabRequest}
        home={(homeActive) => <><ProfileHighlights profile={profile} self={self} actions={actions} graphs={graphs} users={users} onOpenNode={onOpenNode} /><ProfileHome userUuid={profile.uuid} actions={actions} active={homeActive} onOpenNode={onOpenNode} /></>}
        graphToolbar={self && onCreateGraph && <div className="flex items-center justify-between gap-3 pt-4"><a href="#graphs" className="text-button text-xs">管理行动图</a><CreateGraphButton onCreate={onCreateGraph} compact /></div>}
        onOpenNode={onOpenNode} onOpenGraph={onOpenGraph} onOpenReference={onOpenReference} />
    </section>
  )
}
