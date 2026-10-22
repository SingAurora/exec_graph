import { delay, HttpResponse } from 'msw'
import { API_ERROR_CODES } from '../../shared/api/contracts'
import type { MockDatabase } from './database'

/** Expected mock failures use the same business codes and HTTP statuses as the real contract. */
export class MockFailure extends Error {
  constructor(message: string, readonly code: number, readonly status: number) { super(message) }
}

/** Rejects malformed input without inventing successful empty records. */
export function requireInput(condition: unknown, message = '请求参数不合法'): asserts condition {
  if (!condition) throw new MockFailure(message, API_ERROR_CODES.invalidArgument, 400)
}

/** Checks mutable resources against the caller's expected concurrency version. */
export function requireVersion(actual: number, expected: unknown): void {
  requireInput(Number.isInteger(expected) && Number(expected) > 0, '缺少有效的资源版本')
  if (actual !== expected) throw new MockFailure('内容已更新，请刷新后重试', API_ERROR_CODES.conflict, 409)
}

/** Reports stale publication backgrounds and endpoint state as conflicts. */
export function requireCurrent(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MockFailure(message, API_ERROR_CODES.conflict, 409)
}

/** Resolves one resource or returns the standard not-found failure. */
export function requireResource<T>(value: T | undefined): T {
  if (!value) throw new MockFailure('内容不存在或已删除', API_ERROR_CODES.notFound, 404)
  return value
}

/** Reads an object body and rejects fields outside the endpoint's explicit DTO. */
export async function readBody(request: Request, fields: string[]): Promise<Record<string, unknown>> {
  let body: unknown
  try { body = await request.json() } catch { throw new MockFailure('请求内容不是合法 JSON', API_ERROR_CODES.invalidArgument, 400) }
  requireInput(body && typeof body === 'object' && !Array.isArray(body))
  requireInput(Object.keys(body).every((key) => fields.includes(key)), '请求包含不支持的字段')
  return body as Record<string, unknown>
}

/** Returns one contract envelope after deterministic mock latency and CSRF validation. */
export function mockResponse(db: MockDatabase, handler: (request: Request) => unknown | Promise<unknown>) {
  return async ({ request }: { request: Request }) => {
    await delay(100)
    const headers = { 'X-Request-Id': crypto.randomUUID() }
    try {
      if (request.method === 'POST' && request.headers.get('X-CSRF-Token') !== db.csrfToken) throw new MockFailure('请求校验已失效，请刷新后重试', API_ERROR_CODES.forbidden, 403)
      const data = await handler(request)
      return HttpResponse.json({ code: 0, msg: '', data }, { headers })
    } catch (error) {
      if (!(error instanceof MockFailure)) throw error
      return HttpResponse.json({ code: error.code, msg: error.message, data: null }, { status: error.status, headers })
    }
  }
}

/** Replays a confirmed creation after an uncertain network result without creating a second resource. */
export function idempotent<T>(db: MockDatabase, request: Request, input: unknown, create: () => T): T {
  const key = request.headers.get('Idempotency-Key')
  requireInput(key && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key), '缺少有效的提交标识')
  const scope = db.users[0].id + ':' + new URL(request.url).pathname + ':' + key
  const fingerprint = JSON.stringify(input)
  const previous = db.submissions.get(scope)
  if (previous && Date.now() - previous.createdAt < 86_400_000) {
    requireCurrent(previous.fingerprint === fingerprint, '同一个提交标识不能用于不同内容')
    return structuredClone(previous.data) as T
  }
  const data = create()
  db.submissions.set(scope, { fingerprint, data: structuredClone(data), createdAt: Date.now() })
  return data
}
