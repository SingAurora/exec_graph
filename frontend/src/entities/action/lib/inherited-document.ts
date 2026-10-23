import type { ActionDocumentRevision, ActionNode } from '../model/types'
import { getActionParentIds } from './graph'

type InheritedDocumentField = 'expressionMarkdown' | 'agreementMarkdown'
type InheritedDocument = { markdown: string; sourceNode?: ActionNode }

/** 只有尚未被承接或合入的节点可编辑文档，避免改写后来行动已引用的内容。 */
export function canEditActionDocument(nodes: ActionNode[], nodeId: string): boolean {
  const node = nodes.find((item) => item.id === nodeId)
  return Boolean(node
    && !nodes.some((item) => item.projectId === node.projectId && getActionParentIds(item).includes(nodeId)))
}

/** 返回更新后的节点数组：修改本节点的文档及编辑信息，不回写继承来源。 */
export function updateActionDocument(nodes: ActionNode[], nodeId: string, field: InheritedDocumentField, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>): ActionNode[] {
  if (!canEditActionDocument(nodes, nodeId)) return nodes
  const previous = getInheritedActionDocument(nodes, nodeId, field).markdown.trim()
  const next = markdown.trim()
  if (next === previous) return nodes
  const revision: ActionDocumentRevision = { ...editor, kind: !next ? 'clear' : previous ? 'modify' : 'supplement' }
  const revisionField = field === 'expressionMarkdown' ? 'expressionSupplement' : 'agreementSupplement'
  return nodes.map((node) => node.id === nodeId ? { ...node, [field]: next, [revisionField]: revision } : node)
}

/** 沿主要承接链查找有效文档；遇到主动清空或图边界就停止。 */
export function getInheritedActionDocument(nodes: ActionNode[], nodeId: string, field: InheritedDocumentField): InheritedDocument {
  return createDocumentResolver(nodes, field)(nodeId)
}

/** 批量解析有效文档，共用已遍历链路的缓存，避免每个节点重复追溯祖先。 */
export function getInheritedActionDocuments(nodes: ActionNode[], field: InheritedDocumentField): Map<string, InheritedDocument> {
  const resolve = createDocumentResolver(nodes, field)
  return new Map(nodes.map((node) => [node.id, resolve(node.id)]))
}

function createDocumentResolver(nodes: ActionNode[], field: InheritedDocumentField): (nodeId: string) => InheritedDocument {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const resolved = new Map<string, InheritedDocument>()
  return (nodeId) => {
    let current = byId.get(nodeId)
    const projectId = current?.projectId
    const visited = new Set<string>()
    let document: InheritedDocument = { markdown: '' }
    while (current && current.projectId === projectId && !visited.has(current.id)) {
      visited.add(current.id)
      const cached = resolved.get(current.id)
      if (cached) { document = cached; break }
      // 必须判断 undefined；空字符串也是明确版本，表示到这里停止继承，不能用 || 回退。
      const markdown = current[field]
      if (markdown !== undefined) { document = { markdown, sourceNode: current }; break }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    // 这次走过的所有继承节点共用同一来源；后续查询可直接复用结果。
    for (const id of visited) resolved.set(id, document)
    return document
  }
}

/** 查找非空文档实际继承的版本，或本次修改替换的上一版本，供来源说明使用。 */
export function getInheritedActionDocumentOrigin(nodes: ActionNode[], nodeId: string, field: InheritedDocumentField): { kind: 'modified' | 'inherited'; node: ActionNode } | undefined {
  const node = nodes.find((item) => item.id === nodeId)
  const document = getInheritedActionDocument(nodes, nodeId, field)
  if (!node || !document.markdown.trim() || !document.sourceNode) return undefined
  if (document.sourceNode.id !== nodeId) return { kind: 'inherited', node: document.sourceNode }
  const parent = nodes.find((item) => item.id === node.parentId && item.projectId === node.projectId)
  if (!parent) return undefined
  const previous = getInheritedActionDocument(nodes, parent.id, field)
  if (!previous.markdown.trim() || !previous.sourceNode || previous.sourceNode.id === nodeId) return undefined
  return { kind: 'modified', node: previous.sourceNode }
}
