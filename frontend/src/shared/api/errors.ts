/** 区分业务失败、网络、超时、协议错误和主动取消，供界面及重试策略分别处理。 */
export type BusinessErrorKind = 'business' | 'network' | 'timeout' | 'protocol' | 'cancelled'

/** 结构化请求错误：携带类别、HTTP 状态、业务错误码和请求追踪 ID。 */
export class BusinessRequestError extends Error {
  constructor(message: string, readonly kind: BusinessErrorKind, readonly status = 0, readonly code?: number, readonly requestId?: string) {
    super(message)
    this.name = 'BusinessRequestError'
  }
}
