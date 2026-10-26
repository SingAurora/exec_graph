import { API_REQUEST_DEFAULTS } from './contracts'
import { BusinessRequestError } from './errors'

type APIErrorBody = {
  error?: { message?: string }
  msg?: string
}

export type JSONRequestOptions = {
  signal?: AbortSignal
  headers?: HeadersInit
}

/** AI 等原始 HTTP 接口的错误，保留状态码；业务接口另用 BusinessRequestError。 */
export class APIRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'APIRequestError'
    this.status = status
  }
}

/** 下载图片等文件并保留 MIME 类型，返回 Blob 供浏览器预览或保存。 */
export async function getBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new APIRequestError(`图片下载失败（${response.status}）`, response.status)
  return response.blob()
}

/** AI 代理使用的原始 JSON 请求，不强制套用业务接口的 code／msg／data 外壳。 */
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

/** 业务接口的固定路径类型，与 AI 代理和文件下载地址分开。 */
export type BusinessAPIPath = `/api/commands/${string}/${string}`

/** 业务请求选项：支持 Query 取消、CSRF 校验、创建幂等键和单独指定超时。 */
export type BusinessRequestOptions = {
  signal?: AbortSignal
  csrfToken?: string
  idempotencyKey?: string
  timeoutMs?: number
}

type QueryValue = string | number | boolean | readonly (string | number | boolean)[] | null | undefined

/** 读取业务接口，集中编码查询参数并解包 data；调用方不重复检查响应外壳。 */
export function getAPI<T>(path: BusinessAPIPath, query: Record<string, QueryValue> = {}, options: BusinessRequestOptions = {}): Promise<T> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item))
  }
  return requestBusiness<T>(path, params, undefined, options)
}

/** 提交业务 JSON，等待服务确认后返回 data；客户端不自动重试写入。 */
export function postAPI<T, TBody>(path: BusinessAPIPath, body: TBody, options: BusinessRequestOptions = {}): Promise<T> {
  return requestBusiness<T>(path, undefined, body, options)
}

/** 文件请求沿用统一认证与错误边界，Content-Type 的 boundary 由浏览器生成。 */
export function postFormAPI<T>(path: BusinessAPIPath, body: FormData, options: BusinessRequestOptions = {}): Promise<T> {
  return requestBusiness<T>(path, undefined, body, options)
}

/** 统一业务请求边界：处理身份、超时、取消、响应校验和错误分类，不在这里弹提示。 */
async function requestBusiness<T>(path: BusinessAPIPath, query: URLSearchParams | undefined, body: unknown, options: BusinessRequestOptions): Promise<T> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? API_REQUEST_DEFAULTS.timeoutMs)
  // 外部取消与超时共用请求 signal，但在 catch 中分别分类；取消请求不等于撤销服务端写入。
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal
  const base = import.meta.env?.VITE_API_BASE_URL || globalThis.location?.origin
  try {
    if (!/^\/api\/commands\/[a-z][a-z-]*\/[a-z][a-z-]*$/.test(path)) throw new BusinessRequestError('接口路径不合法', 'protocol')
    const url = new URL(path, base)
    if (query) url.search = query.toString()
    const headers = new Headers({ Accept: 'application/json' })
    if (body !== undefined) {
      if (!(body instanceof FormData)) headers.set('Content-Type', 'application/json')
      if (options.csrfToken) headers.set('X-CSRF-Token', options.csrfToken)
      if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
    }
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers, signal, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) })
    const requestId = response.headers.get('X-Request-Id') ?? undefined
    let payload: unknown
    try { payload = await response.json() } catch {
      if (signal.aborted) throw signal.reason
      throw new BusinessRequestError('服务返回了无法识别的响应', 'protocol', response.status, undefined, requestId)
    }
    // 泛型 T 只约束编译期；外部 JSON 仍需运行时校验，不能把 HTML 错误页或畸形响应当空数据。
    if (!payload || typeof payload !== 'object' || !('code' in payload) || !Number.isInteger(payload.code)
      || !('msg' in payload) || typeof payload.msg !== 'string' || !('data' in payload)) {
      throw new BusinessRequestError('服务响应格式不正确', 'protocol', response.status, undefined, requestId)
    }
    // HTTP 成功和业务 code 为 0 必须同时成立，否则保留 code、状态码及追踪 ID 向上抛出。
    if (!response.ok || payload.code !== 0) throw new BusinessRequestError(payload.msg || `请求失败（${response.status}）`, 'business', response.status, payload.code as number, requestId)
    return payload.data as T
  } catch (error) {
    if (options.signal?.aborted) throw new BusinessRequestError('请求已取消', 'cancelled')
    if (timeout.signal.aborted) throw new BusinessRequestError('请求超时，请重试', 'timeout')
    if (error instanceof BusinessRequestError) throw error
    throw new BusinessRequestError('网络连接失败，请重试', 'network')
  } finally { clearTimeout(timer) }
}
