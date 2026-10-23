import type { ActionNode } from '../model/types'
import { getActionReferences } from './references'

/** 起点为第 1 层，多来源节点取最深来源层级加一；层级不等于稳定展示编号。 */
export function getActionLevels(actions: ActionNode[]): Map<string, number> {
  const remainingSources = new Map(actions.map((node) => [node.id, 0]))
  const children = new Map<string, string[]>()
  for (const reference of getActionReferences(actions)) {
    remainingSources.set(reference.target.id, remainingSources.get(reference.target.id)! + 1)
    children.set(reference.source.id, [...(children.get(reference.source.id) ?? []), reference.target.id])
  }
  const levels = new Map(actions.map((node) => [node.id, 1]))
  const ready = actions.filter((node) => remainingSources.get(node.id) === 0).map((node) => node.id)
  // 拓扑队列确保所有来源先处理，再计算后续层级；不依赖数组顺序，也避免深递归。
  for (let index = 0; index < ready.length; index++) {
    const id = ready[index]
    for (const childId of children.get(id) ?? []) {
      levels.set(childId, Math.max(levels.get(childId)!, levels.get(id)! + 1))
      const remaining = remainingSources.get(childId)! - 1
      remainingSources.set(childId, remaining)
      if (remaining === 0) ready.push(childId)
    }
  }
  if (ready.length !== actions.length) throw new Error('行动引用关系存在循环，无法计算层级。')
  return levels
}
