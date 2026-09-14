type ErrorResponse = {
  error?: string
}

type AuthenticatedRequestInit = RequestInit & {
  accessToken?: string
}

/**
 * The API is JSON-only today. Keeping transport concerns here lets store actions
 * describe their domain operation instead of rebuilding headers and error parsing.
 */
export async function requestJSON<T>(path: string, init: AuthenticatedRequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`)

  const response = await fetch(path, { ...init, headers })
  const data = (await response.json().catch(() => ({}))) as T & ErrorResponse
  if (!response.ok) throw new Error(data.error ?? `请求失败（HTTP ${response.status}）。`)
  return data
}

export function bearerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}
