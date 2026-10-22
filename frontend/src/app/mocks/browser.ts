import { setupWorker } from 'msw/browser'
import { createMockHandlers } from './handlers'

const worker = setupWorker(...createMockHandlers())

/** Starts the explicitly enabled demo API before React issues its first query. */
export async function startMockAPI(): Promise<void> {
  await worker.start({ quiet: true, onUnhandledRequest(request, print) {
    if (new URL(request.url).pathname.startsWith('/api/commands/')) print.error()
  } })
}
