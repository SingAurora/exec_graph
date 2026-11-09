import { useQuery } from '@tanstack/react-query'
import { profileStatsKey, readProfileStats, type AccountProfile } from '../../entities/profile/api/profiles'
import { followingKeys, readFollowing } from '../../entities/following/api/following'

/** 应用级只保留账号数据：关注关系与侧栏统计；页面业务数据由各页面自行查询。 */
export function useAppResources(user: AccountProfile | null) {
  const signedIn = Boolean(user)
  const scope = user?.uuid ?? 'public'
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled: signedIn })
  const profileStats = useQuery({ queryKey: profileStatsKey(user?.uuid ?? ''), queryFn: ({ signal }) => readProfileStats(user!.uuid, signal), enabled: signedIn })

  const sources = signedIn && following.data ? following.data : { userUuids: [], graphUuids: [], users: [] }
  const error = following.error ?? profileStats.error
  const ready = !signedIn || Boolean(following.data && profileStats.data)
  const retry = () => { if (signedIn) { void following.refetch(); void profileStats.refetch() } }
  return { sources, profileStats: profileStats.data, ready, error, retry }
}
