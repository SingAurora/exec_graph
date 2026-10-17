import type { ActionNode } from '../../../entities/action/model/types'
import { getActionContextIds } from '../../../entities/action/lib/graph'
import { cookingExamples } from './records'
import { getCookingConversation } from './conversations'

/** Shared guidance for the cooking project's header and captured node contexts. */
export const cookingContextGuide = '持续关注做法是否容易复做、时间紧张时是否仍然成立；把个人偏好和实际观察分开记录。'

const records: ActionNode[] = cookingExamples.map(({ parent, mergedParents = [], images = [], expression, ...example }) => ({
  ...example,
  id: `cooking-${example.number}`,
  projectId: 'cooking',
  parentId: parent ? `cooking-${parent}` : undefined,
  mergedParentIds: mergedParents.map((number) => `cooking-${number}`),
  images,
  objectiveMarkdown: example.markdown,
  expressionMarkdown: expression,
  contextSnapshot: {
    directNodeIds: [...(parent ? [`cooking-${parent}`] : []), ...mergedParents.map((number) => `cooking-${number}`)],
    historyNodeCount: 0,
    guide: cookingContextGuide,
  },
  conversation: getCookingConversation(example.number),
}))

/** Static prototype actions whose background includes only reachable source actions. */
export const cookingActions: ActionNode[] = records.map((node) => ({
  ...node,
  contextSnapshot: { ...node.contextSnapshot!, historyNodeCount: getActionContextIds(records, node.id).size - 1 },
}))
