import { useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PublicProfile } from '../widgets/profile/PublicProfile'
import type { ActivityTab } from '../widgets/feed/ActivityFeed'
import { profileStatsKey, profileTabKeys, readProfileActions, readProfileAgreements, readProfileExpressions, readProfileGraphs, readProfileInfo, readProfileStats } from '../entities/profile/api/profiles'
import { ListSkeleton } from '../shared/ui/ListSkeleton'

// “我的”和用户主页共用界面；URL 可指定用户及直接打开的栏目。
function readProfileRoute(currentUserUuid: string) {
  const view = window.location.hash.split('?')[0]
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const tab = query.get('tab')
  const activityTabRequest: ComponentProps<typeof PublicProfile>['activityTabRequest'] = tab === 'home' || tab === 'actions' || tab === 'expressions' || tab === 'agreements' || tab === 'graphs' || tab === 'search' ? { value: tab } : undefined
  return { userUuid: view === '#profile' ? query.get('userUuid') ?? '' : currentUserUuid, activityTabRequest }
}

type ProfilePageProps = Omit<ComponentProps<typeof PublicProfile>, 'profile' | 'following' | 'activityTabRequest' | 'tab' | 'onTabChange' | 'stats' | 'graphCount' | 'users' | 'graphs' | 'actions'> & { followingIds: string[] }
type ProfileSlotProps = ProfilePageProps & {
  userUuid: string
  followingIds: string[]
  request: ComponentProps<typeof PublicProfile>['activityTabRequest']
  active: boolean
}

/** 每个已访问主页独立读取资料，并按当前 Tab 懒加载对应资源。 */
function ProfileSlot({ userUuid, followingIds, request, active, ...props }: ProfileSlotProps) {
  const [tab, setTab] = useState<ActivityTab>(request?.value ?? 'home')
  const info = useQuery({ queryKey: ['profiles', userUuid, 'info'], queryFn: ({ signal }) => readProfileInfo(userUuid, signal), enabled: active && Boolean(userUuid) })
  const stats = useQuery({ queryKey: profileStatsKey(userUuid), queryFn: ({ signal }) => readProfileStats(userUuid, signal), enabled: active && Boolean(userUuid) })
  const graphCount = useQuery({ queryKey: profileTabKeys.graphCount(userUuid), queryFn: ({ signal }) => readProfileGraphs(userUuid, 1, signal), enabled: active && Boolean(userUuid) })
  const graphList = useQuery({ queryKey: profileTabKeys.graphs(userUuid), queryFn: ({ signal }) => readProfileGraphs(userUuid, 50, signal), enabled: active && Boolean(userUuid) && tab === 'graphs' })
  const expressions = useQuery({ queryKey: profileTabKeys.expressions(userUuid), queryFn: ({ signal }) => readProfileExpressions(userUuid, signal), enabled: active && Boolean(userUuid) && tab === 'expressions' })
  const agreements = useQuery({ queryKey: profileTabKeys.agreements(userUuid), queryFn: ({ signal }) => readProfileAgreements(userUuid, signal), enabled: active && Boolean(userUuid) && tab === 'agreements' })
  const actions = useQuery({ queryKey: profileTabKeys.actions(userUuid), queryFn: ({ signal }) => readProfileActions(userUuid, signal), enabled: active && Boolean(userUuid) && (tab === 'home' || tab === 'actions' || tab === 'search') })

  const tabData = tab === 'expressions' ? expressions.data : tab === 'agreements' ? agreements.data : actions.data
  const tabActions = useMemo(() => tab === 'graphs' ? [] : (tabData?.actions ?? []), [tab, tabData])
  const tabGraphs = useMemo(() => tab === 'graphs' ? (graphList.data?.items ?? []) : (tabData?.graphs ?? []), [tab, tabData, graphList.data?.items])
  const users = useMemo(() => {
    if (!info.data) return []
    const byId = new Map([[info.data.uuid, info.data]])
    for (const node of tabActions) if (node.author && !byId.has(node.author.uuid)) byId.set(node.author.uuid, node.author)
    return [...byId.values()]
  }, [info.data, tabActions])

  if (!active) return <div className="pt-6"><ListSkeleton rows={4} /></div>
  if (info.isLoading) return <div className="pt-6"><ListSkeleton rows={4} /></div>
  if (info.isError || !info.data) return <p className="empty-state">用户不存在</p>
  return (
    <PublicProfile
      {...props}
      profile={info.data}
      users={users}
      graphs={tabGraphs}
      actions={tabActions}
      stats={stats.data}
      graphCount={graphCount.data?.total}
      active={active}
      activityTabRequest={request}
      tab={tab}
      onTabChange={setTab}
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
