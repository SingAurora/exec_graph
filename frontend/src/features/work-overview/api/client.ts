import { getJSON, postJSON, withQuery } from '@/shared/api/client'

export type DailyActivity = {
  uuid: string
  kind: 'started' | 'completed' | 'sealed'
  projectUuid: string
  projectTitle: string
  nodeUuid?: string
  title: string
  detail?: string
  createdAt: string
  startedAt?: string
  endedAt?: string
}

export type DailyReview = {
  uuid: string
  date: string
  summary: string
  momentum: string
  highlights: string[]
  friction: string[]
  nextStep: string
  aiConfig: { label: string; provider: string; model: string }
  createdAt: string
  updatedAt: string
}

export type WorkDay = { date: string; activities: DailyActivity[]; review?: DailyReview }
export type WorkOverview = { month: string; days: WorkDay[] }

export const getMonthlyWorkOverview = (accessToken: string, month: string) =>
  getJSON<WorkOverview>(withQuery('/api/commands/work-overview/get-monthly-work-overview', { month }), accessToken)

export const reviewDailyActivity = (accessToken: string, date: string) =>
  postJSON<{ review: DailyReview }>('/api/commands/work-overview/review-daily-activity', { date }, accessToken)
