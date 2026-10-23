import { setupWorker } from 'msw/browser'
import { createMockHandlers } from './handlers'

const worker = setupWorker(...createMockHandlers())

/** 在 React 首次查询前启动浏览器请求拦截；只有开发环境显式开启模拟时才调用。 */
export async function startMockAPI(): Promise<void> {
  await worker.start({ quiet: true, onUnhandledRequest(request, print) {
    // 模拟模式漏配业务接口就报错，避免意外写入真实服务；AI 和图片请求继续放行。
    if (new URL(request.url).pathname.startsWith('/api/commands/')) print.error()
  } })
}
