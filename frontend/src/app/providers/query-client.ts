import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { BusinessRequestError } from '../../shared/api/errors'
import { API_ERROR_CODES } from '../../shared/api/contracts'
import { profileKeys } from '../../entities/profile/api/profiles'

/** 读取仅对网络、超时及部分临时服务错误重试一次；取消和可预期业务错误不重试。 */
export function retryBusinessQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof BusinessRequestError && (error.kind === 'network' || error.kind === 'timeout'
    || (error.kind === 'business' && [502, 503, 504].includes(error.status)))
}

/** 创建全局请求缓存；30 秒内视为新鲜，无订阅保留 10 分钟，写入失败不自动重试。 */
export function createQueryClient(): QueryClient {
  const expired = (error: unknown) => {
    if (!(error instanceof BusinessRequestError) || error.code !== API_ERROR_CODES.unauthenticated) return
    // 先取消旧账号读取，再切换匿名；本地草稿由账号隔离，不在会话失效时删除。
    void client.cancelQueries().then(() => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      client.setQueryData(profileKeys.session, null)
    })
  }
  const client = new QueryClient({ queryCache: new QueryCache({ onError: expired }), mutationCache: new MutationCache({ onError: expired }), defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 600_000, refetchOnWindowFocus: false, retry: retryBusinessQuery },
    mutations: { retry: false },
  } })
  return client
}
