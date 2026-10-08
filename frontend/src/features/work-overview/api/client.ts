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

export type ActionWindow = 'today' | '7d' | '30d'
export type ActionState = {
  window: ActionWindow
  range: {
    start: string
    end: string
    timezone: string
    partial: boolean
  }
  coverage: {
    windowDays: number
    activeDays: number
    reviewedDays: number
    confidence: 'low' | 'medium' | 'high'
  }
  facts: {
    activities: number
    started: number
    confirmedRecords: number
    sealedRecords: number
  }
  comparison: {
    previousActivities: number
    previousActiveDays: number
    activityChange: number
    activeDaysChange: number
    conclusion: string
  }
  recentActivities: DailyActivity[]
}

export const getMonthlyWorkOverview = (accessToken: string, month: string) =>
  getJSON<WorkOverview>(withQuery('/api/commands/work-overview/get-monthly-work-overview', { month }), accessToken)

export const reviewDailyActivity = (accessToken: string, date: string) =>
  postJSON<{ review: DailyReview }>('/api/commands/work-overview/review-daily-activity', { date }, accessToken)

export const getActionState = (accessToken: string, window: ActionWindow) =>
  getJSON<ActionState>(withQuery('/api/commands/work-overview/get-action-state', { window }), accessToken)
