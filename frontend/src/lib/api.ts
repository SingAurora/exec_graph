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

export function bearerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}
