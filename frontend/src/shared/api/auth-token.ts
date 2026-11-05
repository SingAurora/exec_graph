/** 浏览器保存的 Bearer token；仅用于 API 认证，不写入业务缓存。 */
const STORAGE_KEY = 'exec_graph_auth_token'

export function readAuthToken(): string {
  try { return globalThis.localStorage?.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

export function writeAuthToken(token: string): void {
  try {
    if (token) globalThis.localStorage?.setItem(STORAGE_KEY, token)
    else globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 浏览器禁用存储时仍允许当前页面内登录，刷新后需要重新登录。
  }
}

export function clearAuthToken(): void {
  writeAuthToken('')
}
