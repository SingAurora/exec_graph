type APIErrorBody = {
  error?: { message?: string }
  msg?: string
}

export type JSONRequestOptions = {
  signal?: AbortSignal
  headers?: HeadersInit
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

/** Reads a file through the shared HTTP boundary, preserving its MIME type. */
export async function getBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new APIRequestError(`图片下载失败（${response.status}）`, response.status)
  return response.blob()
}

/** Sends JSON through the shared HTTP boundary and decodes the JSON response. */
export async function postJSON<TResponse, TBody>(url: string, body: TBody, options: JSONRequestOptions = {}): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
    signal: options.signal,
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
