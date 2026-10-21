import type { ActionDocumentRevision, ActionNode } from '../model/types'
import { getActionParentIds } from './graph'

type InheritedDocumentField = 'expressionMarkdown' | 'agreementMarkdown'
type InheritedDocument = { markdown: string; sourceNode?: ActionNode }

/** Published documents remain editable until the node is continued or incorporated in its graph. */
export function canEditActionDocument(nodes: ActionNode[], nodeId: string): boolean {
  const node = nodes.find((item) => item.id === nodeId)
  return Boolean(node
    && !nodes.some((item) => item.projectId === node.projectId && getActionParentIds(item).includes(nodeId)))
}

/** Saves a local document version, including explicit clears, without changing its source. */
export function updateActionDocument(nodes: ActionNode[], nodeId: string, field: InheritedDocumentField, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>): ActionNode[] {
  if (!canEditActionDocument(nodes, nodeId)) return nodes
  const previous = getInheritedActionDocument(nodes, nodeId, field).markdown.trim()
  const next = markdown.trim()
  if (next === previous) return nodes
  const revision: ActionDocumentRevision = { ...editor, kind: !next ? 'clear' : previous ? 'modify' : 'supplement' }
  const revisionField = field === 'expressionMarkdown' ? 'expressionSupplement' : 'agreementSupplement'
  return nodes.map((node) => node.id === nodeId ? { ...node, [field]: next, [revisionField]: revision } : node)
}

/** Resolves a document along primary parents, stopping at explicit clears and graph boundaries. */
export function getInheritedActionDocument(nodes: ActionNode[], nodeId: string, field: InheritedDocumentField): InheritedDocument {
  return createDocumentResolver(nodes, field)(nodeId)
}

/** Resolves all node versions in linear time, reusing already traversed primary-parent paths. */
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
      const markdown = current[field]
      if (markdown !== undefined) { document = { markdown, sourceNode: current }; break }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    for (const id of visited) resolved.set(id, document)
    return document
  }
}

/** Finds the version a nonempty inherited document uses or a local document replaces. */
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
