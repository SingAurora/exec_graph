import { useEffect, useState, type ComponentProps } from 'react'
import { PublicProfile } from '../widgets/profile/PublicProfile'

function readProfileRoute() {
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const tab = query.get('tab')
  const activityTabRequest: ComponentProps<typeof PublicProfile>['activityTabRequest'] = tab === 'actions' || tab === 'expressions' || tab === 'agreements' || tab === 'graphs' ? { value: tab } : undefined
  return { userId: query.get('userId'), activityTabRequest }
}

type ProfilePageProps = Omit<ComponentProps<typeof PublicProfile>, 'profile' | 'following' | 'activityTabRequest'> & { followingIds: string[] }

/** Resolves the profile route while preserving the public activity tabs. */
export function ProfilePage({ followingIds, ...props }: ProfilePageProps) {
  const [profileRoute, setProfileRoute] = useState(readProfileRoute)
  useEffect(() => {
    let previousView = window.location.hash.split('?')[0]
    const syncProfile = () => {
      const nextView = window.location.hash.split('?')[0]
      if (nextView === '#profile') {
        const next = readProfileRoute()
        const returningFromGraph = ['#project', '#publish', '#action-archive'].includes(previousView)
        setProfileRoute((current) => returningFromGraph && current.userId === next.userId ? current : next)
      }
      previousView = nextView
    }
    window.addEventListener('hashchange', syncProfile)
    return () => window.removeEventListener('hashchange', syncProfile)
  }, [])
  const profile = props.users.find((user) => user.id === profileRoute.userId)
  return profile ? <PublicProfile key={profile.id} {...props} profile={profile} activityTabRequest={profileRoute.activityTabRequest} following={followingIds.includes(profile.id)} /> : <p className="empty-state" role="status">用户不存在</p>
}
