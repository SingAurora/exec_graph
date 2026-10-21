import { describe, expect, test } from 'bun:test'
import { enqueueToast } from './queue.ts'

const entry = (id, message = id, extra = {}) => ({ id, message, open: true, ...extra })

describe('toast queue', () => {
  test('keeps only the latest three in chronological order without mutating the current queue', () => {
    const current = Object.freeze([entry('1'), entry('2'), entry('3')])
    expect(enqueueToast(current, entry('4')).map((toast) => toast.id)).toEqual(['2', '3', '4'])
    expect(current.map((toast) => toast.id)).toEqual(['1', '2', '3'])
  })

  test('moves repeated feedback to the bottom with a new timer and the latest undo callback', () => {
    const onClick = () => {}
    const duplicate = entry('old', '已取消关注', { action: { label: '撤销', onClick: () => {} } })
    const incoming = entry('new', '已取消关注', { duration: 4000, action: { label: '撤销', onClick } })
    const next = enqueueToast([duplicate, entry('other')], incoming)
    expect(next.map((toast) => toast.id)).toEqual(['other', 'new'])
    expect(next[1].action.onClick).toBe(onClick)
    expect(next[1].duration).toBe(4000)
    expect(enqueueToast([entry('old', '已保存')], entry('new', '已保存', { kind: 'info' }))).toEqual([entry('new', '已保存', { kind: 'info' })])
  })

  test('drops closing entries and keeps distinct severity or action controls separate', () => {
    const current = [entry('closed', '旧提示', { open: false }), entry('info', '保存失败')]
    const next = enqueueToast(current, entry('error', '保存失败', { kind: 'error' }))
    expect(next.map((toast) => toast.id)).toEqual(['info', 'error'])
    expect(enqueueToast(next, entry('retry', '保存失败', { kind: 'error', action: { label: '重试', onClick: () => {} } })).map((toast) => toast.id)).toEqual(['info', 'error', 'retry'])
  })
})
