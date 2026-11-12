import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { BusinessRequestError } from '../../shared/api/errors'
import { API_ERROR_CODES } from '../../shared/api/contracts'
import { useAuthStore } from '../../features/auth/model/auth-store'
import { invalidateFirstLevelPages } from '../../shared/lib/query-cache'

/** 读取仅对网络、超时及部分临时服务错误重试一次；取消和可预期业务错误不重试。 */
export function retryBusinessQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof BusinessRequestError && (error.kind === 'network' || error.kind === 'timeout'
    || (error.kind === 'business' && [502, 503, 504].includes(error.status)))
}

/** 创建全局请求状态；不保留长期缓存，每次挂载重新读取，写入失败不自动重试。 */
export function createQueryClient(): QueryClient {
  const expired = (error: unknown) => {
    if (!(error instanceof BusinessRequestError) || error.code !== API_ERROR_CODES.unauthenticated) return
    // 先取消旧账号读取并清空业务缓存，再让 AuthStore 回到未登录状态。
    void client.cancelQueries().then(() => {
      client.removeQueries()
      useAuthStore.getState().expire()
    })
  }
  const client: QueryClient = new QueryClient({ queryCache: new QueryCache({ onError: expired }), mutationCache: new MutationCache({
    onError: expired,
    // 一级页面缓存不自动过期；写入成功后统一失效，切回时读取新内容。
    onSuccess: () => invalidateFirstLevelPages(client),
  }), defaultOptions: {
    queries: { staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false, retry: retryBusinessQuery },
    mutations: { retry: false },
  } })
  return client
}
