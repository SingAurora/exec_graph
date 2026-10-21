import { describe, expect, test } from 'bun:test'
import { formatFullPublicationTime, formatPublicationTime } from './date.ts'

const localTime = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute)

describe('publication time labels', () => {
  test('uses calendar relationships and includes the year only for older years', () => {
    const now = localTime(2026, 10, 18)
    const examples = [
      [localTime(2026, 10, 18, 0, 5), '今天 00:05'],
      [localTime(2026, 10, 17, 19, 30), '昨天 19:30'],
      [localTime(2026, 10, 14, 18, 20), '周三 18:20'],
      [localTime(2026, 10, 12, 8, 5), '周一 08:05'],
      [localTime(2026, 10, 11, 18, 20), '10月11日 18:20'],
      [localTime(2025, 10, 8, 18, 20), '2025年10月8日 18:20'],
    ]
    for (const [date, expected] of examples) expect(formatPublicationTime(date.toISOString(), now)).toBe(expected)
  })

  test('yesterday takes precedence across weeks, months, and years', () => {
    expect(formatPublicationTime(localTime(2026, 10, 18, 23, 59).toISOString(), localTime(2026, 10, 19, 0, 1))).toBe('昨天 23:59')
    expect(formatPublicationTime(localTime(2026, 9, 30, 23, 59).toISOString(), localTime(2026, 10, 1, 0, 1))).toBe('昨天 23:59')
    expect(formatPublicationTime(localTime(2025, 12, 31, 23, 59).toISOString(), localTime(2026, 1, 1, 0, 1))).toBe('昨天 23:59')
  })

  test('hover text always includes the full local date and preserves invalid values', () => {
    expect(formatFullPublicationTime(localTime(2026, 10, 18, 0, 5).toISOString())).toBe('2026年10月18日 00:05')
    expect(formatPublicationTime('未知时间')).toBe('未知时间')
    expect(formatFullPublicationTime('未知时间')).toBe('未知时间')
  })
})
