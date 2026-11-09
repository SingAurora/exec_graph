import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PublicProfile } from '../widgets/profile/PublicProfile'
import { profileContentKey, readProfileContent } from '../entities/profile/api/profiles'

// “我的”和用户主页共用界面；URL 可指定用户及直接打开的栏目。
function readProfileRoute(currentUserUuid: string) {
  const view = window.location.hash.split('?')[0]
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const tab = query.get('tab')
  const activityTabRequest: ComponentProps<typeof PublicProfile>['activityTabRequest'] = tab === 'home' || tab === 'actions' || tab === 'expressions' || tab === 'agreements' || tab === 'graphs' || tab === 'search' ? { value: tab } : undefined
  return { userUuid: view === '#profile' ? query.get('userUuid') ?? '' : currentUserUuid, activityTabRequest }
}

type ProfilePageProps = Omit<ComponentProps<typeof PublicProfile>, 'profile' | 'following' | 'activityTabRequest'> & { followingIds: string[] }
type ProfileSlotProps = Omit<ProfilePageProps, 'users' | 'graphs' | 'actions'> & {
  userUuid: string
  followingIds: string[]
  request: ComponentProps<typeof PublicProfile>['activityTabRequest']
  active: boolean
}

/** 每个已访问主页独立读取自己的行动子图，切换时不会互相覆盖。 */
function ProfileSlot({ userUuid, followingIds, request, active, ...props }: ProfileSlotProps) {
  const content = useQuery({
    queryKey: profileContentKey(userUuid),
    queryFn: ({ signal }) => readProfileContent(userUuid, signal),
    enabled: active && Boolean(userUuid),
  })
  if (content.isLoading) return <p className="empty-state">加载中…</p>
  if (!content.data) return <p className="empty-state">用户不存在</p>
  const users = content.data.profile
    ? [content.data.profile, ...content.data.actions.flatMap((action) => action.author ? [action.author] : []).filter((user, index, list) => user.uuid !== content.data!.profile.uuid && list.findIndex((item) => item.uuid === user.uuid) === index)]
    : []
  return (
    <PublicProfile
      {...props}
      profile={content.data.profile}
      users={users}
      graphs={content.data.graphs}
      actions={content.data.actions}
      active={active}
      activityTabRequest={request}
      following={followingIds.includes(userUuid)}
    />
  )
}

/** 本人和公开主页共用页面；已访问用户保持挂载，分别保留栏目、筛选和时间线位置。 */
export function ProfilePage({ followingIds, ...props }: ProfilePageProps) {
  const [profileRoute, setProfileRoute] = useState(() => readProfileRoute(props.currentUserUuid))
  const [visited, setVisited] = useState(() => new Map([[profileRoute.userUuid, profileRoute.activityTabRequest]]))
  const lastProfileHash = useRef(window.location.hash)
  useLayoutEffect(() => {
    let previousView = window.location.hash.split('?')[0]
    const syncProfile = () => {
      const nextView = window.location.hash.split('?')[0]
      if (nextView === '#profile' || nextView === '#my') {
        const next = readProfileRoute(props.currentUserUuid)
        const returningFromGraph = ['#graph', '#publish', '#action-archive'].includes(previousView) && lastProfileHash.current === window.location.hash
        setProfileRoute(next)
        setVisited((current) => {
          if (current.has(next.userUuid) && (returningFromGraph || !next.activityTabRequest)) return current
          return new Map(current).set(next.userUuid, next.activityTabRequest)
        })
        lastProfileHash.current = window.location.hash
      }
      previousView = nextView
    }
    window.addEventListener('hashchange', syncProfile)
    return () => window.removeEventListener('hashchange', syncProfile)
  }, [props.currentUserUuid])
  // hidden 只隐藏而不卸载；active 再通知内部滚动监听等 effect 暂停，避免后台面板继续工作。
  return (
    <>
      {[...visited].map(([userUuid, request]) => (
        <div hidden={userUuid !== profileRoute.userUuid} key={userUuid}>
          <ProfileSlot {...props} userUuid={userUuid} followingIds={followingIds} request={request} active={Boolean(props.active && userUuid === profileRoute.userUuid)} />
        </div>
      ))}
    </>
  )
}
