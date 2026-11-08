const CHINA_TIME_ZONE = 'Asia/Shanghai'

type ChinaTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CHINA_TIME_ZONE,
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 解析为中国固定时区的日历部分；无效时间返回 null。 */
function chinaParts(value: string | Date): ChinaTimeParts | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const values: Record<string, number> = {}
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dayNumber(parts: ChinaTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

/** 中国固定时区的日历键，例如 2026-10-18。 */
export function getChinaDateKey(value: string | Date): string | null {
  const parts = chinaParts(value)
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

/** 按中国固定时区显示“今天/昨天/周几/日期”，不使用浏览器时区。 */
export function formatPublicationTime(value: string, now = new Date()) {
  const date = chinaParts(value)
  const current = chinaParts(now)
  if (!date || !current) return value
  const dateDay = dayNumber(date)
  const today = dayNumber(current)
  const yesterday = today - 86_400_000
  const weekStart = today - ((new Date(today).getUTCDay() + 6) % 7) * 86_400_000
  const time = `${pad(date.hour)}:${pad(date.minute)}`
  if (dateDay === today) return `今天 ${time}`
  if (dateDay === yesterday) return `昨天 ${time}`
  if (dateDay >= weekStart && dateDay < today) return `周${'日一二三四五六'[new Date(dateDay).getUTCDay()]} ${time}`
  const year = date.year === current.year ? '' : `${date.year}年`
  return `${year}${date.month}月${date.day}日 ${time}`
}

/** 中国固定时区的完整日期，用于悬浮显示。 */
export function formatFullPublicationTime(value: string) {
  const parts = chinaParts(value)
  if (!parts) return value
  return `${parts.year}年${parts.month}月${parts.day}日 ${pad(parts.hour)}:${pad(parts.minute)}`
}
