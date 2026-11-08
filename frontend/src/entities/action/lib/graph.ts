import type { ActionNode } from '../model/types'

/** 直接来源先放主要承接，再放去重后的合入节点，同时排除自我引用。 */
export function getActionParentUuids(node: ActionNode): string[] {
  return [...new Set([...(node.parentUuid ? [node.parentUuid] : []), ...(node.mergedParentUuids ?? [])])]
    .filter((id) => id !== node.uuid)
}

/** 旧帖子计数口径：返回有来源的路线终点，不包含孤立起点；现有表达流使用 published.ts。 */
export function getActionPostNodes(nodes: ActionNode[]): ActionNode[] {
  if (!nodes.length) return []
  const parentUuids = new Set(nodes.flatMap((node) => [
    ...(node.parentUuid ? [node.parentUuid] : []),
    ...(node.mergedParentUuids ?? []),
  ]))
  return nodes
    .filter((node) => !parentUuids.has(node.uuid) && (node.parentUuid || node.mergedParentUuids?.length))
    .sort((a, b) => b.number - a.number)
}

/** 按旧口径统计有来源的终点；不要用此函数代替当前有效表达数量。 */
export function getActionPostCount(nodes: ActionNode[]): number {
  return getActionPostNodes(nodes).length
}

/** 收集当前节点及所有引用历史的 ID，遍历承接和合入两种来源，集合避免重复和循环。 */
export function getActionContextIds(nodes: ActionNode[], nodeUuid: string): Set<string> {
  const byId = new Map(nodes.map((node) => [node.uuid, node]))
  const included = new Set<string>()
  const pending = [nodeUuid]
  while (pending.length) {
    const id = pending.pop()!
    const node = byId.get(id)
    if (!node || included.has(id)) continue
    included.add(id)
    pending.push(...getActionParentUuids(node))
  }
  return included
}

/** 仅沿主要承接关系追溯，从起点到选中节点排序，用于主链高亮；合入背景另行处理。 */
export function getAncestors(nodes: ActionNode[], nodeUuid: string): ActionNode[] {
  const byId = new Map(nodes.map((node) => [node.uuid, node]))
  const path: ActionNode[] = []
  const seen = new Set<string>()
  let current = byId.get(nodeUuid)
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid)
    path.unshift(current)
    current = current.parentUuid ? byId.get(current.parentUuid) : undefined
  }
  return path
}

/** 选择最长承接路线，同长度保留编号较早的路线；用于阅读路径选择，不代表内容排名。 */
export function getPreferredPath(nodes: ActionNode[], fromId?: string): ActionNode[] {
  const ids = new Set(nodes.map((node) => node.uuid))
  const children = new Map<string | undefined, ActionNode[]>()
  for (const node of [...nodes].sort((a, b) => a.number - b.number)) {
    const parent = node.parentUuid && ids.has(node.parentUuid) ? node.parentUuid : undefined
    children.set(parent, [...(children.get(parent) ?? []), node])
  }
  // 先用显式栈遍历，再反向计算各节点的最长后续路线，避免长历史耗尽递归调用栈。
  const visit = [...(fromId ? nodes.filter((node) => node.uuid === fromId) : children.get(undefined) ?? [])]
  const order: ActionNode[] = []
  const seen = new Set<string>()
  while (visit.length) {
    const node = visit.pop()!
    if (seen.has(node.uuid)) continue
    seen.add(node.uuid)
    order.push(node)
    visit.push(...(children.get(node.uuid) ?? []))
  }
  const lengths = new Map<string, number>()
  const next = new Map<string, ActionNode>()
  for (const node of order.reverse()) {
    const best = (children.get(node.uuid) ?? []).filter((child) => lengths.has(child.uuid))
      .sort((a, b) => lengths.get(b.uuid)! - lengths.get(a.uuid)! || a.number - b.number)[0]
    lengths.set(node.uuid, 1 + (best ? lengths.get(best.uuid)! : 0))
    if (best) next.set(node.uuid, best)
  }
  let current = fromId ? nodes.find((node) => node.uuid === fromId) : (children.get(undefined) ?? [])
    .sort((a, b) => (lengths.get(b.uuid) ?? 0) - (lengths.get(a.uuid) ?? 0) || a.number - b.number)[0]
  const path: ActionNode[] = []
  const included = new Set<string>()
  while (current && !included.has(current.uuid)) {
    included.add(current.uuid)
    path.push(current)
    current = next.get(current.uuid)
  }
  return path
}

/** 拼接选中节点的承接祖先和首选后续路线，并去掉拼接点处重复的当前节点。 */
export function getPathThrough(nodes: ActionNode[], nodeUuid: string): ActionNode[] {
  return [...getAncestors(nodes, nodeUuid).slice(0, -1), ...getPreferredPath(nodes, nodeUuid)]
}
