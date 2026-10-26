import type { ActionAgreement, ActionNode } from '../model/types'
import { getActionExpression, sortActionsNewestFirst } from './expressions'
import { getActionAgreement } from './agreements'

/** 一份可展示的表达或约定，以及承载这份明确版本的行动节点。 */
export type ProfileHighlightEntry = { node: ActionNode; markdown: string; agreement: ActionAgreement }

/**
 * 精选本人分支上的本人表达；继承本人表达的不同节点可携带不同约定，因此保留节点身份。
 * 所选节点固定，不自动移动到后续分叉；约定只沿该节点的承接链继承，不混入合入分支。
 */
export function getProfileHighlightCandidates(actions: ActionNode[], userId: string): ProfileHighlightEntry[] {
  return sortActionsNewestFirst(actions).flatMap((node) => {
    const expression = getActionExpression(actions, node.id)
    const source = expression.sourceNode
    const authorId = source?.expressionSupplement?.authorId ?? source?.authorId
    const ownsBranch = node.authorId === userId || node.expressionSupplement?.authorId === userId
    return ownsBranch && authorId === userId && expression.markdown.trim()
      ? [{ node, markdown: expression.markdown, agreement: getActionAgreement(actions, node.id) }]
      : []
  })
}
