import type { QueryClient } from '@tanstack/react-query'

/** 一级页面切换时保留已加载内容；写入成功后由 mutation 主动失效。 */
export const firstLevelPageCache = { staleTime: Infinity } as const

/** 一级页面共用缓存失效：发现、关注、个人主页。二级页面保持自己的读取策略。 */
export function invalidateFirstLevelPages(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ['feed'] })
  void client.invalidateQueries({ queryKey: ['following'] })
  void client.invalidateQueries({ queryKey: ['profiles'] })
}
