import type { ActionNode } from '../../entities/action/model/types'
import { canDeleteProject } from '../../entities/project/lib/permissions'
import type { ActionTopic, CompletionNode, PlanNode, Project, Reaction } from '../../shared/model'

/** In-memory graph content owned by the static frontend prototype. */
export type ProjectContentState = {
  projects: Project[]
  actions: ActionNode[]
  topics: ActionTopic[]
  plans: PlanNode[]
  completions: CompletionNode[]
  reactions: Record<string, Reaction>
}

/** Removes one authorized graph and its content only when the confirmed node count still matches. */
export function deleteProjectContent(state: ProjectContentState, projectId: string, userId: string, expectedNodeCount: number): ProjectContentState | undefined {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project || !canDeleteProject(project, userId, state.actions)) return undefined
  if (state.actions.filter((node) => node.projectId === projectId).length !== expectedNodeCount) return undefined
  const topicIds = new Set(state.topics.filter((topic) => topic.projectId === projectId).map((topic) => topic.id))
  const planIds = new Set(state.plans.filter((plan) => topicIds.has(plan.topicId)).map((plan) => plan.id))
  const completionIds = new Set(state.completions.filter((item) => topicIds.has(item.topicId) || planIds.has(item.planNodeId)).map((item) => item.id))
  return {
    projects: state.projects.filter((item) => item.id !== projectId),
    actions: state.actions.filter((node) => node.projectId !== projectId),
    topics: state.topics.filter((topic) => !topicIds.has(topic.id)),
    plans: state.plans.filter((plan) => !planIds.has(plan.id)),
    completions: state.completions.filter((item) => !completionIds.has(item.id)),
    reactions: Object.fromEntries(Object.entries(state.reactions).filter(([id]) => !completionIds.has(id) && !planIds.has(id))),
  }
}
