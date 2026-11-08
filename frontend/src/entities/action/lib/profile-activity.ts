import type { ActionNode } from '../model/types'
import { getChinaDateKey } from '../../../shared/lib/date'
import { sortActionsNewestFirst } from './expressions'

/** A person's published action grouped by its original local publication day. */
export type ProfileActivity = {
  node: ActionNode
  date: string
}

/** One local calendar day in the rolling action heatmap. */
export type ProfileActivityDay = { date: string; count: number }

/** 中国固定时区的日历键；跨日边界不能被浏览器或 UTC 时区改写。 */
export function getActivityDate(value: string | Date): string {
  return getChinaDateKey(value) ?? ''
}

/** One row per action, regardless of later expression or agreement edits. */
export function getProfileActivity(actions: ActionNode[], userUuid: string): ProfileActivity[] {
  return sortActionsNewestFirst(actions.filter((node) => node.authorUuid === userUuid && Number.isFinite(Date.parse(node.createdAt))))
    .map((node) => ({ node, date: getActivityDate(node.createdAt) }))
}

/** Exactly 365 China calendar days ending today; edits and other people's actions never add activity. */
export function getProfileActivityDays(activity: ProfileActivity[], today = new Date()): ProfileActivityDay[] {
  const counts = new Map<string, number>()
  for (const item of activity) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const todayKey = getChinaDateKey(today)
  if (!todayKey) return []
  const start = Date.UTC(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10))) - 364 * 86_400_000
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10)
    return { date, count: counts.get(date) ?? 0 }
  })
}

/** Groups the already ordered timeline without merging different actions on the same day. */
export function groupProfileActivity(activity: ProfileActivity[]): { date: string; items: ProfileActivity[] }[] {
  const groups = new Map<string, ProfileActivity[]>()
  for (const item of activity) {
    const items = groups.get(item.date) ?? []
    items.push(item)
    groups.set(item.date, items)
  }
  return [...groups].map(([date, items]) => ({ date, items }))
}
