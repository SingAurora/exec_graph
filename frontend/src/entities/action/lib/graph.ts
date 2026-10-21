import type { ActionNode } from '../model/types'

/** Lists the primary continuation first, followed by distinct incorporated contexts. */
export function getActionParentIds(node: ActionNode): string[] {
  return [...new Set([...(node.parentId ? [node.parentId] : []), ...(node.mergedParentIds ?? [])])]
    .filter((id) => id !== node.id)
}

/** Returns the current endpoint of every published action route. */
export function getActionPostNodes(nodes: ActionNode[]): ActionNode[] {
  if (!nodes.length) return []
  const parentIds = new Set(nodes.flatMap((node) => [
    ...(node.parentId ? [node.parentId] : []),
    ...(node.mergedParentIds ?? []),
  ]))
  return nodes
    .filter((node) => !parentIds.has(node.id) && (node.parentId || node.mergedParentIds?.length))
    .sort((a, b) => b.number - a.number)
}

/** Counts posts by route endpoint; a graph containing only its starting node has no post yet. */
export function getActionPostCount(nodes: ActionNode[]): number {
  return getActionPostNodes(nodes).length
}

/** Collects the selected action and all of its source contexts, including merges. */
export function getActionContextIds(nodes: ActionNode[], nodeId: string): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const included = new Set<string>()
  const pending = [nodeId]
  while (pending.length) {
    const id = pending.pop()!
    const node = byId.get(id)
    if (!node || included.has(id)) continue
    included.add(id)
    pending.push(...getActionParentIds(node))
  }
  return included
}

/** Returns the ancestors and selected node in reading order, even for incomplete imports. */
export function getAncestors(nodes: ActionNode[], nodeId: string): ActionNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const path: ActionNode[] = []
  const seen = new Set<string>()
  let current = byId.get(nodeId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

/** Selects the longest continuation; equal lengths retain the earlier published route. */
export function getPreferredPath(nodes: ActionNode[], fromId?: string): ActionNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  const children = new Map<string | undefined, ActionNode[]>()
  for (const node of [...nodes].sort((a, b) => a.number - b.number)) {
    const parent = node.parentId && ids.has(node.parentId) ? node.parentId : undefined
    children.set(parent, [...(children.get(parent) ?? []), node])
  }
  // An explicit stack avoids exhausting the call stack on long project histories.
  const visit = [...(fromId ? nodes.filter((node) => node.id === fromId) : children.get(undefined) ?? [])]
  const order: ActionNode[] = []
  const seen = new Set<string>()
  while (visit.length) {
    const node = visit.pop()!
    if (seen.has(node.id)) continue
    seen.add(node.id)
    order.push(node)
    visit.push(...(children.get(node.id) ?? []))
  }
  const lengths = new Map<string, number>()
  const next = new Map<string, ActionNode>()
  for (const node of order.reverse()) {
    const best = (children.get(node.id) ?? []).filter((child) => lengths.has(child.id))
      .sort((a, b) => lengths.get(b.id)! - lengths.get(a.id)! || a.number - b.number)[0]
    lengths.set(node.id, 1 + (best ? lengths.get(best.id)! : 0))
    if (best) next.set(node.id, best)
  }
  let current = fromId ? nodes.find((node) => node.id === fromId) : (children.get(undefined) ?? [])
    .sort((a, b) => (lengths.get(b.id) ?? 0) - (lengths.get(a.id) ?? 0) || a.number - b.number)[0]
  const path: ActionNode[] = []
  const included = new Set<string>()
  while (current && !included.has(current.id)) {
    included.add(current.id)
    path.push(current)
    current = next.get(current.id)
  }
  return path
}

/** Includes a selected branch's ancestors and its preferred continuation. */
export function getPathThrough(nodes: ActionNode[], nodeId: string): ActionNode[] {
  return [...getAncestors(nodes, nodeId).slice(0, -1), ...getPreferredPath(nodes, nodeId)]
}
