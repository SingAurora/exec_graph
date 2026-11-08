import type { ActionNode } from '../../entities/action/model/types'
import { canDeleteGraph } from '../../entities/graph/lib/permissions'
import type { ActionTopic, CompletionNode, PlanNode, Reaction } from '../../entities/action/model/legacy-types'
import type { Graph } from '../../entities/graph/model/types'

/** In-memory graph content owned by the static frontend prototype. */
export type GraphContentState = {
  graphs: Graph[]
  actions: ActionNode[]
  topics: ActionTopic[]
  plans: PlanNode[]
  completions: CompletionNode[]
  reactions: Record<string, Reaction>
}

/** Removes one authorized graph and its content only when the confirmed node count still matches. */
export function deleteGraphContent(state: GraphContentState, graphUuid: string, userUuid: string, expectedNodeCount: number): GraphContentState | undefined {
  const graph = state.graphs.find((item) => item.uuid === graphUuid)
  if (!graph || !canDeleteGraph(graph, userUuid, state.actions)) return undefined
  if (state.actions.filter((node) => node.graphUuid === graphUuid).length !== expectedNodeCount) return undefined
  const topicIds = new Set(state.topics.filter((topic) => topic.graphUuid === graphUuid).map((topic) => topic.id))
  const planIds = new Set(state.plans.filter((plan) => topicIds.has(plan.topicId)).map((plan) => plan.id))
  const completionIds = new Set(state.completions.filter((item) => topicIds.has(item.topicId) || planIds.has(item.planNodeUuid)).map((item) => item.id))
  return {
    graphs: state.graphs.filter((item) => item.uuid !== graphUuid),
    actions: state.actions.filter((node) => node.graphUuid !== graphUuid),
    topics: state.topics.filter((topic) => !topicIds.has(topic.id)),
    plans: state.plans.filter((plan) => !planIds.has(plan.id)),
    completions: state.completions.filter((item) => !completionIds.has(item.id)),
    reactions: Object.fromEntries(Object.entries(state.reactions).filter(([id]) => !completionIds.has(id) && !planIds.has(id))),
  }
}
