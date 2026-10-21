import { useId, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { GenderMark } from '../../../shared/ui/profile/GenderMark'
import { ProfileBiography } from './ProfileBiography'
import { ProfileCover } from './ProfileCover'

type ProfilePreviewProps = {
  profile?: UserProfile
  userId: string
  href?: string
  className?: string
  children: ReactNode
}

/** Opens a public profile preview before navigating through its avatar or name. */
export function ProfilePreview({ profile, userId, href, className = '', children }: ProfilePreviewProps) {
  const name = profile?.name ?? userId
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button type="button" className={`cursor-pointer border-0 bg-transparent p-0 text-left ${className}`} aria-label={`查看${name}的资料`}>
        {children}
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="pointer-events-auto z-[90] max-h-[calc(100dvh-24px)] w-72 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface text-ink shadow-app outline-none" sideOffset={8} collisionPadding={12} align="start" aria-label={`${name}的个人资料`}>
        <ProfilePreviewCard profile={profile} userId={userId} href={href} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}

/** Public-only card content; account email stays in the signed-in sidebar card. */
export function ProfilePreviewCard({ profile, userId, href }: Pick<ProfilePreviewProps, 'profile' | 'userId' | 'href'>) {
  const name = profile?.name ?? userId
  const profileHref = href ?? '#profile?userId=' + encodeURIComponent(userId)
  const nameId = useId()
  const linkClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'
  return <section aria-labelledby={nameId}>
    <ProfileCover image={profile?.backgroundImage} size="sidebar" />
    <div className="px-4 pb-4">
      <Popover.Close asChild><a href={profileHref} className={`relative -mt-7 inline-flex rounded-full border-4 border-surface bg-surface align-top ${linkClass}`} aria-label={`查看${name}的主页`}>
        <Avatar profile={profile} label={name} size="profile" shape="circle" />
      </a></Popover.Close>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        <Popover.Close asChild><a id={nameId} href={profileHref} className={`min-w-0 truncate rounded-sm text-base font-semibold hover:text-signal ${linkClass}`}>{name}</a></Popover.Close>
        {profile && <GenderMark gender={profile.gender} />}
      </div>
      {profile?.bio.trim() && <div className="mt-3"><ProfileBiography biography={profile.bio} compact /></div>}
    </div>
  </section>
}
