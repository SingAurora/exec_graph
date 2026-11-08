import { describe, expect, test } from 'bun:test'
import { formatFullPublicationTime, formatPublicationTime } from './date.ts'

// 测试固定按北京时间构造，不依赖运行环境的本地时区。
const chinaTime = (year, month, day, hour = 12, minute = 0) => new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)

describe('publication time labels', () => {
  test('uses calendar relationships and includes the year only for older years', () => {
    const now = chinaTime(2026, 10, 18)
    const examples = [
      [chinaTime(2026, 10, 18, 0, 5), '今天 00:05'],
      [chinaTime(2026, 10, 17, 19, 30), '昨天 19:30'],
      [chinaTime(2026, 10, 14, 18, 20), '周三 18:20'],
      [chinaTime(2026, 10, 12, 8, 5), '周一 08:05'],
      [chinaTime(2026, 10, 11, 18, 20), '10月11日 18:20'],
      [chinaTime(2025, 10, 8, 18, 20), '2025年10月8日 18:20'],
    ]
    for (const [date, expected] of examples) expect(formatPublicationTime(date.toISOString(), now)).toBe(expected)
  })

  test('yesterday takes precedence across weeks, months, and years', () => {
    expect(formatPublicationTime(chinaTime(2026, 10, 18, 23, 59).toISOString(), chinaTime(2026, 10, 19, 0, 1))).toBe('昨天 23:59')
    expect(formatPublicationTime(chinaTime(2026, 9, 30, 23, 59).toISOString(), chinaTime(2026, 10, 1, 0, 1))).toBe('昨天 23:59')
    expect(formatPublicationTime(chinaTime(2025, 12, 31, 23, 59).toISOString(), chinaTime(2026, 1, 1, 0, 1))).toBe('昨天 23:59')
  })

  test('uses China time even when the runtime timezone is UTC', () => {
    expect(formatPublicationTime('2026-10-18T16:30:00Z', new Date('2026-10-19T00:00:00Z'))).toBe('今天 00:30')
    expect(formatFullPublicationTime('2026-10-18T16:30:00Z')).toBe('2026年10月19日 00:30')
  })

  test('hover text always includes the full China date and preserves invalid values', () => {
    expect(formatFullPublicationTime(chinaTime(2026, 10, 18, 0, 5).toISOString())).toBe('2026年10月18日 00:05')
    expect(formatPublicationTime('未知时间')).toBe('未知时间')
    expect(formatFullPublicationTime('未知时间')).toBe('未知时间')
  })
})
