import type { CompletionNode, PlanNode } from '../../../entities/action/model/legacy-types'

export type BranchSummary = {
  id: string
  title: string
  plans: PlanNode[]
  completedCount: number
  continuationCount: number
  feedback: number
  score: number
  isMain: boolean
}

export function getPlanBranchId(plan: PlanNode) {
  return plan.branchId ?? 'main'
}

export function getPlanBranchTitle(plan: PlanNode) {
  return plan.branchTitle ?? (getPlanBranchId(plan) === 'main' ? '主楼' : plan.title)
}

/** Returns the readable path for a branch, including shared ancestor floors. */
export function getBranchPath(branchId: string, plans: PlanNode[]) {
  const planByID = new Map(plans.map((plan) => [plan.id, plan]))
  const branchPlans = plans.filter((plan) => getPlanBranchId(plan) === branchId)
  const result: PlanNode[] = []
  const seen = new Set<string>()

  const appendWithAncestors = (plan: PlanNode) => {
    if (plan.parentPlanId) {
      const parent = planByID.get(plan.parentPlanId)
      if (parent) appendWithAncestors(parent)
    }
    if (!seen.has(plan.id)) {
      seen.add(plan.id)
      result.push(plan)
    }
  }

  branchPlans.forEach(appendWithAncestors)
  return result
}

/** Ranks branches using execution facts. Feedback is deliberately only a small tie-breaker. */
export function buildBranchSummaries(plans: PlanNode[], completions: CompletionNode[]): BranchSummary[] {
  const groups = new Map<string, PlanNode[]>()
  plans.forEach((plan) => {
    const branchId = getPlanBranchId(plan)
    const branchPlans = groups.get(branchId) ?? []
    branchPlans.push(plan)
    groups.set(branchId, branchPlans)
  })

  const completionByPlan = new Map(completions.map((completion) => [completion.planNodeId, completion]))
  const summaries = Array.from(groups, ([id, branchPlans]) => {
    const planIds = new Set(branchPlans.map((plan) => plan.id))
    const completedCount = branchPlans.filter((plan) => plan.status === 'completed' || completionByPlan.has(plan.id)).length
    const continuationCount = plans.filter((plan) => plan.parentPlanId && planIds.has(plan.parentPlanId)).length
    const feedback = branchPlans.reduce((total, plan) => {
      const completion = completionByPlan.get(plan.id)
      return total + (completion ? completion.believeCount - completion.doubtCount : 0)
    }, 0)
    const score = completedCount * 10 + branchPlans.length * 2 + continuationCount * 4 + Math.max(0, feedback)
    return { id, title: getPlanBranchTitle(branchPlans[0]), plans: branchPlans, completedCount, continuationCount, feedback, score, isMain: false }
  }).sort((left, right) => right.score - left.score || right.completedCount - left.completedCount)

  if (summaries[0]) summaries[0].isMain = true
  return summaries
}
