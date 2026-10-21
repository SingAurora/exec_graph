import type { ActionNode } from '../model/types'
import { sortActionsNewestFirst } from './expressions'

/** A person's published action grouped by its original local publication day. */
export type ProfileActivity = {
  node: ActionNode
  date: string
}

/** One local calendar day in the rolling action heatmap. */
export type ProfileActivityDay = { date: string; count: number }

/** Stable local calendar key; timestamps near midnight must not be grouped by UTC. */
export function getActivityDate(value: string | Date): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** One row per action, regardless of later expression or agreement edits. */
export function getProfileActivity(actions: ActionNode[], userId: string): ProfileActivity[] {
  return sortActionsNewestFirst(actions.filter((node) => node.authorId === userId && Number.isFinite(Date.parse(node.createdAt))))
    .map((node) => ({ node, date: getActivityDate(node.createdAt) }))
}

/** Exactly 365 local days ending today; edits and other people's actions never add activity. */
export function getProfileActivityDays(activity: ProfileActivity[], today = new Date()): ProfileActivityDay[] {
  const counts = new Map<string, number>()
  for (const item of activity) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  start.setDate(start.getDate() - 364)
  return Array.from({ length: 365 }, (_, index) => {
    const day = new Date(start)
    day.setDate(day.getDate() + index)
    const date = getActivityDate(day)
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
