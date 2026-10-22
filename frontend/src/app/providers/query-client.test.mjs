import { describe, expect, test } from 'bun:test'
import { createQueryClient } from './query-client.ts'
import { BusinessRequestError } from '../../shared/api/errors.ts'
import { graphKeys } from '../../entities/project/api/graphs.ts'
import { QueryObserver } from '@tanstack/react-query'

describe('application Query cache and retry policy', () => {
  test('deduplicates reads, keeps fresh data and isolates account scopes', async () => {
    const client = createQueryClient()
    let reads = 0
    const options = { queryKey: graphKeys.catalogue('jo'), queryFn: async () => { reads++; await Promise.resolve(); return ['jo-graph'] } }
    try {
      expect(await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])).toEqual([['jo-graph'], ['jo-graph']])
      await client.fetchQuery(options)
      expect(reads).toBe(1)
      expect(client.getQueryData(graphKeys.catalogue('lin'))).toBeUndefined()
      await client.invalidateQueries({ queryKey: options.queryKey })
      await client.fetchQuery(options)
      expect(reads).toBe(2)
    } finally { client.clear() }
  })

  test('retries transient reads once; never retries conflicts, cancellations or mutations', async () => {
    const client = createQueryClient()
    let reads = 0
    try {
      await expect(client.fetchQuery({ queryKey: ['transient'], retryDelay: 0, queryFn: () => { reads++; throw new BusinessRequestError('断线', 'network') } })).rejects.toThrow('断线')
      expect(reads).toBe(2)
      for (const error of [new BusinessRequestError('冲突', 'business', 409, 10005), new BusinessRequestError('取消', 'cancelled'), new BusinessRequestError('无权限', 'business', 403, 10003)]) {
        let count = 0
        await expect(client.fetchQuery({ queryKey: [error.message], retryDelay: 0, queryFn: () => { count++; throw error } })).rejects.toBe(error)
        expect(count).toBe(1)
      }
      let writes = 0
      const mutation = client.getMutationCache().build(client, { mutationFn: async () => { writes++; throw new BusinessRequestError('断线', 'network') } })
      await expect(mutation.execute({})).rejects.toThrow('断线')
      expect(writes).toBe(1)
    } finally { client.clear() }
  })

  test('forwards cancellation to a consumed signal and does not store late data', async () => {
    const client = createQueryClient()
    let signal
    try {
      const promise = client.fetchQuery({ queryKey: ['cancel'], queryFn: (context) => {
        signal = context.signal
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
      } })
      await client.cancelQueries({ queryKey: ['cancel'] })
      await expect(promise).rejects.toThrow()
      expect(signal.aborted).toBe(true)
      expect(client.getQueryData(['cancel'])).toBeUndefined()
    } finally { client.clear() }
  })

  test('resetting an observed session removes old data without disconnecting later writes', async () => {
    const client = createQueryClient()
    const queryKey = graphKeys.catalogue('jo')
    const observer = new QueryObserver(client, { queryKey, queryFn: async () => ['server-graph'] })
    const seen = []
    const unsubscribe = observer.subscribe((result) => seen.push(result.data))
    try {
      await observer.refetch()
      client.setQueryData(queryKey, ['old-account-data'])
      await client.cancelQueries()
      await client.resetQueries()
      expect(seen).toContain(undefined)
      expect(observer.getCurrentResult().data).toEqual(['server-graph'])
      client.setQueryData(queryKey, ['newly-created-graph'])
      expect(observer.getCurrentResult().data).toEqual(['newly-created-graph'])
    } finally { unsubscribe(); client.clear() }
  })
})
