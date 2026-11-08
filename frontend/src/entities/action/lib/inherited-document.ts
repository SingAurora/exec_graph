import type { ActionDocumentRevision, ActionNode } from '../model/types'
import { getActionParentUuids } from './graph'

type InheritedDocumentField = 'expressionMarkdown' | 'agreementMarkdown'
type InheritedDocument = { markdown: string; sourceNode?: ActionNode }

/** 只有尚未被承接或合入的节点可编辑文档，避免改写后来行动已引用的内容。 */
export function canEditActionDocument(nodes: ActionNode[], nodeUuid: string): boolean {
  const node = nodes.find((item) => item.uuid === nodeUuid)
  return Boolean(node
    && !nodes.some((item) => item.graphUuid === node.graphUuid && getActionParentUuids(item).includes(nodeUuid)))
}

/** 返回更新后的节点数组：修改本节点的文档及编辑信息，不回写继承来源。 */
export function updateActionDocument(nodes: ActionNode[], nodeUuid: string, field: InheritedDocumentField, markdown: string, editor: Pick<ActionDocumentRevision, 'authorUuid' | 'createdAt'>): ActionNode[] {
  if (!canEditActionDocument(nodes, nodeUuid)) return nodes
  const previous = getInheritedActionDocument(nodes, nodeUuid, field).markdown.trim()
  const next = markdown.trim()
  if (next === previous) return nodes
  const revision: ActionDocumentRevision = { ...editor, kind: !next ? 'clear' : previous ? 'modify' : 'supplement' }
  const revisionField = field === 'expressionMarkdown' ? 'expressionSupplement' : 'agreementSupplement'
  return nodes.map((node) => node.uuid === nodeUuid ? { ...node, [field]: next, [revisionField]: revision } : node)
}

/** 沿主要承接链查找有效文档；遇到主动清空或图边界就停止。 */
export function getInheritedActionDocument(nodes: ActionNode[], nodeUuid: string, field: InheritedDocumentField): InheritedDocument {
  return createDocumentResolver(nodes, field)(nodeUuid)
}

/** 批量解析有效文档，共用已遍历链路的缓存，避免每个节点重复追溯祖先。 */
export function getInheritedActionDocuments(nodes: ActionNode[], field: InheritedDocumentField): Map<string, InheritedDocument> {
  const resolve = createDocumentResolver(nodes, field)
  return new Map(nodes.map((node) => [node.uuid, resolve(node.uuid)]))
}

function createDocumentResolver(nodes: ActionNode[], field: InheritedDocumentField): (nodeUuid: string) => InheritedDocument {
  const byId = new Map(nodes.map((node) => [node.uuid, node]))
  const resolved = new Map<string, InheritedDocument>()
  return (nodeUuid) => {
    let current = byId.get(nodeUuid)
    const graphUuid = current?.graphUuid
    const visited = new Set<string>()
    let document: InheritedDocument = { markdown: '' }
    while (current && current.graphUuid === graphUuid && !visited.has(current.uuid)) {
      visited.add(current.uuid)
      const cached = resolved.get(current.uuid)
      if (cached) { document = cached; break }
      // 新节点有自己的文档状态，绝不再沿祖先继承；只有旧夹具没有状态字段时才走旧回退。
      const statusField = field === 'expressionMarkdown' ? 'expressionStatus' : 'agreementStatus'
      if (current[statusField] !== undefined) {
        document = { markdown: current[field] ?? '', sourceNode: current }
        break
      }
      // 必须判断 undefined；空字符串也是明确版本，表示到这里停止继承，不能用 || 回退。
      const markdown = current[field]
      if (markdown !== undefined) { document = { markdown, sourceNode: current }; break }
      current = current.parentUuid ? byId.get(current.parentUuid) : undefined
    }
    // 这次走过的所有继承节点共用同一来源；后续查询可直接复用结果。
    for (const id of visited) resolved.set(id, document)
    return document
  }
}

/** 查找非空文档实际继承的版本，或本次修改替换的上一版本，供来源说明使用。 */
export function getInheritedActionDocumentOrigin(nodes: ActionNode[], nodeUuid: string, field: InheritedDocumentField): { kind: 'modified' | 'inherited'; node: ActionNode } | undefined {
  const node = nodes.find((item) => item.uuid === nodeUuid)
  if (node && (field === 'expressionMarkdown' ? node.expressionStatus : node.agreementStatus) !== undefined) return undefined
  const document = getInheritedActionDocument(nodes, nodeUuid, field)
  if (!node || !document.markdown.trim() || !document.sourceNode) return undefined
  if (document.sourceNode.uuid !== nodeUuid) return { kind: 'inherited', node: document.sourceNode }
  const parent = nodes.find((item) => item.uuid === node.parentUuid && item.graphUuid === node.graphUuid)
  if (!parent) return undefined
  const previous = getInheritedActionDocument(nodes, parent.uuid, field)
  if (!previous.markdown.trim() || !previous.sourceNode || previous.sourceNode.uuid === nodeUuid) return undefined
  return { kind: 'modified', node: previous.sourceNode }
}
