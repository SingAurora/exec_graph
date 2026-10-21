import { afterEach, describe, expect, test } from 'bun:test'
import { observeListEnd } from './useInfiniteList.ts'

const originalObserver = globalThis.IntersectionObserver
afterEach(() => {
  if (originalObserver === undefined) delete globalThis.IntersectionObserver
  else globalThis.IntersectionObserver = originalObserver
})

function createObserver() {
  const instances = []
  globalThis.IntersectionObserver = class {
    disconnected = false
    constructor(callback) { this.callback = callback; instances.push(this) }
    observe(element) { this.element = element }
    disconnect() { this.disconnected = true }
    notify(isIntersecting) { this.callback([{ isIntersecting }]) }
  }
  return instances
}

describe('retained infinite list boundaries', () => {
  test('hidden, paginated and exhausted lists do not subscribe; empty lists need no boundary', () => {
    const instances = createObserver()
    observeListEnd({}, false, () => { throw new Error('inactive list loaded') })()
    observeListEnd(null, true, () => { throw new Error('missing boundary loaded') })()
    expect(instances).toHaveLength(0)
  })

  test('one intersection loads one batch even when notifications are repeated', () => {
    const instances = createObserver()
    const element = {}
    let loads = 0
    const stop = observeListEnd(element, true, () => loads++)
    expect(instances[0].element).toBe(element)
    instances[0].notify(false)
    expect(loads).toBe(0)
    instances[0].notify(true)
    instances[0].notify(true)
    expect(loads).toBe(1)
    expect(instances[0].disconnected).toBe(true)
    stop()
  })

  test('switching away cancels queued notifications; returning can load the next batch', () => {
    const instances = createObserver()
    let loads = 0
    const stop = observeListEnd({}, true, () => loads++)
    stop()
    instances[0].notify(true)
    expect(loads).toBe(0)
    const stopNext = observeListEnd({}, true, () => loads++)
    instances[1].notify(true)
    expect(loads).toBe(1)
    stopNext()
  })
})
