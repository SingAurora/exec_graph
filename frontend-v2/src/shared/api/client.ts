type APIErrorBody = {
  error?: { message?: string }
  msg?: string
}

/** Error returned by an HTTP API with its status code preserved. */
export class APIRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'APIRequestError'
    this.status = status
  }
}

/** Sends JSON through the shared HTTP boundary and decodes the JSON response. */
export async function postJSON<TResponse, TBody>(url: string, body: TBody, signal?: AbortSignal): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  const payload = await readJSON<TResponse | APIErrorBody>(response)
  if (!response.ok) {
    const error = payload as APIErrorBody
    throw new APIRequestError(error.error?.message || error.msg || `请求失败（${response.status}）`, response.status)
  }

  return payload as TResponse
}

async function readJSON<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  } catch {
    throw new APIRequestError('AI 服务返回了无法识别的内容。', response.status)
  }
}
