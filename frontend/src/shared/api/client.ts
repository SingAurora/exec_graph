export type APIResponse<T> = {
  code: number
  msg: string
  data: T | null
}

type AuthenticatedRequestInit = RequestInit & {
  accessToken?: string
}

export function withQuery(path: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value)
  }
  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}

export async function parseJSONResponse<T>(response: Response): Promise<T> {
  const envelope = (await response.json().catch(() => null)) as Partial<APIResponse<T>> | null
  const message = envelope?.msg ?? `请求失败（HTTP ${response.status}）。`
  if (!response.ok || envelope?.code !== 0) throw new Error(message)
  return envelope.data as T
}

/**
 * The API is JSON-only today. Keeping transport concerns here lets store actions
 * describe their domain operation instead of rebuilding headers and error parsing.
 */
export async function requestJSON<T>(path: string, init: AuthenticatedRequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`)

  const response = await fetch(path, { method: 'POST', ...init, headers })
  return parseJSONResponse<T>(response)
}

// getJSON 和 postJSON 是页面与组件访问 JSON API 的唯一入口。它们统一处理
// Authorization、响应信封和错误信息，业务组件无需再自行拼装 fetch。
export function getJSON<T>(path: string, accessToken?: string): Promise<T> {
  return requestJSON<T>(path, { method: 'GET', accessToken })
}

export function postJSON<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return requestJSON<T>(path, { method: 'POST', accessToken, body: JSON.stringify(body) })
}

// requestFormData 用于头像等文件上传。浏览器会负责 multipart boundary，因此
// 不能手动设置 Content-Type；其余鉴权和响应处理与 JSON 请求保持一致。
export async function requestFormData<T>(path: string, body: FormData, accessToken?: string): Promise<T> {
  const headers = new Headers()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(path, { method: 'POST', headers, body })
  return parseJSONResponse<T>(response)
}

export function bearerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}
