import type { ActionAgreement, ActionAgreementOrigin, ActionDocumentRevision, ActionNode } from '../model/types'
import { canEditActionDocument, getInheritedActionDocument, getInheritedActionDocumentOrigin, getInheritedActionDocuments, updateActionDocument } from './inherited-document'

/** 一次解析全图各节点的有效约定，供引用关系批量核对使用。 */
export function getActionAgreements(nodes: ActionNode[]): Map<string, ActionAgreement> {
  return getInheritedActionDocuments(nodes, 'agreementMarkdown')
}

/** 读取本节点传给后续引用者的有效约定；只沿承接链继承，尊重主动清空。 */
export function getActionAgreement(nodes: ActionNode[], nodeUuid: string): ActionAgreement {
  return getInheritedActionDocument(nodes, nodeUuid, 'agreementMarkdown')
}

/** 跳过仅继承的中间节点，定位约定的真实来源版本。 */
export function getActionAgreementOrigin(nodes: ActionNode[], nodeUuid: string): ActionAgreementOrigin | undefined {
  return getInheritedActionDocumentOrigin(nodes, nodeUuid, 'agreementMarkdown')
}

/** 与表达共用编辑资格：只有未被后续引用的节点可以修改当前有效约定。 */
export function canEditActionAgreement(nodes: ActionNode[], nodeUuid: string): boolean {
  return canEditActionDocument(nodes, nodeUuid)
}

/** 修改本节点向后的约定，不改行动事实、本次来源约定核对和既有对话。 */
export function updateActionAgreement(nodes: ActionNode[], nodeUuid: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorUuid' | 'createdAt'>): ActionNode[] {
  return updateActionDocument(nodes, nodeUuid, 'agreementMarkdown', markdown, editor)
}
