import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { PublicProfile } from '../widgets/profile/PublicProfile'

function readProfileRoute(currentUserId: string) {
  const view = window.location.hash.split('?')[0]
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const tab = query.get('tab')
  const activityTabRequest: ComponentProps<typeof PublicProfile>['activityTabRequest'] = tab === 'home' || tab === 'actions' || tab === 'expressions' || tab === 'agreements' || tab === 'graphs' || tab === 'search' ? { value: tab } : undefined
  return { userId: view === '#profile' ? query.get('userId') ?? '' : currentUserId, activityTabRequest }
}

type ProfilePageProps = Omit<ComponentProps<typeof PublicProfile>, 'profile' | 'following' | 'activityTabRequest'> & { followingIds: string[] }

/** Shares the personal and public routes, retaining each visited person's tabs and timeline state. */
export function ProfilePage({ followingIds, ...props }: ProfilePageProps) {
  const [profileRoute, setProfileRoute] = useState(() => readProfileRoute(props.currentUserId))
  const [visited, setVisited] = useState(() => new Map([[profileRoute.userId, profileRoute.activityTabRequest]]))
  const lastProfileHash = useRef(window.location.hash)
  useLayoutEffect(() => {
    let previousView = window.location.hash.split('?')[0]
    const syncProfile = () => {
      const nextView = window.location.hash.split('?')[0]
      if (nextView === '#profile' || nextView === '#my') {
        const next = readProfileRoute(props.currentUserId)
        const returningFromGraph = ['#project', '#publish', '#action-archive'].includes(previousView) && lastProfileHash.current === window.location.hash
        setProfileRoute(next)
        setVisited((current) => {
          if (current.has(next.userId) && (returningFromGraph || !next.activityTabRequest)) return current
          return new Map(current).set(next.userId, next.activityTabRequest)
        })
        lastProfileHash.current = window.location.hash
      }
      previousView = nextView
    }
    window.addEventListener('hashchange', syncProfile)
    return () => window.removeEventListener('hashchange', syncProfile)
  }, [props.currentUserId])
  return <>
    {[...visited].map(([userId, request]) => {
      const profile = props.users.find((user) => user.id === userId)
      return profile && <div hidden={userId !== profileRoute.userId} key={userId}><PublicProfile {...props} profile={profile} active={Boolean(props.active && userId === profileRoute.userId)} activityTabRequest={request} following={followingIds.includes(userId)} /></div>
    })}
    {!props.users.some((user) => user.id === profileRoute.userId) && <p className="empty-state" role="status">用户不存在</p>}
  </>
}
