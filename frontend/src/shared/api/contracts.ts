/** 业务契约与开发模拟共用的稳定错误码；界面按 code 判断，不依赖中文提示文本。 */
export const API_ERROR_CODES = {
  invalidArgument: 10001,
  unauthenticated: 10002,
  forbidden: 10003,
  notFound: 10004,
  conflict: 10005,
  rateLimited: 10006,
  internal: 10007,
  unavailable: 10008,
  upstream: 10009,
} as const

/** 统一业务响应外壳：仅 code 为 0 表示成功，所有非零值（包括未知码）都按失败处理。 */
export type APIResponse<T> = {
  code: number
  msg: string
  data: T | null
}

/** 普通内容流的游标参数契约；不传 cursor 从第一批开始，当前完整上下文接口尚未分页。 */
export type CursorPaginationInput = {
  cursor?: string
  limit?: number
}

/** 一批远端列表结果；nextCursor 为 null 才表示结束。 */
export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}

/** 显式提交搜索使用页码分页，page 从 1 开始。 */
export type SearchPaginationInput = {
  page: number
  pageSize: number
}

/** 搜索结果页，total 是相同已提交条件下的总匹配数。 */
export type SearchPage<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** 首版请求契约的默认分页和超时值，供客户端及模拟接口共用。 */
export const API_REQUEST_DEFAULTS = {
  pageSize: 6,
  maxPageSize: 50,
  timeoutMs: 15_000,
} as const
