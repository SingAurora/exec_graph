import type { ActionAgreement, ActionAgreementOrigin, ActionDocumentRevision, ActionNode } from '../model/types'
import { canEditActionDocument, getInheritedActionDocument, getInheritedActionDocumentOrigin, getInheritedActionDocuments, updateActionDocument } from './inherited-document'

/** Resolves all effective agreement versions once for graph-wide reference assessment. */
export function getActionAgreements(nodes: ActionNode[]): Map<string, ActionAgreement> {
  return getInheritedActionDocuments(nodes, 'agreementMarkdown')
}

/** Resolves the effective agreement, ignoring merged sources and honoring explicit clears. */
export function getActionAgreement(nodes: ActionNode[], nodeId: string): ActionAgreement {
  return getInheritedActionDocument(nodes, nodeId, 'agreementMarkdown')
}

/** Skips unchanged intermediates when identifying the inherited or revised agreement version. */
export function getActionAgreementOrigin(nodes: ActionNode[], nodeId: string): ActionAgreementOrigin | undefined {
  return getInheritedActionDocumentOrigin(nodes, nodeId, 'agreementMarkdown')
}

/** Uses the same endpoint eligibility as editing an expression, including inherited versions. */
export function canEditActionAgreement(nodes: ActionNode[], nodeId: string): boolean {
  return canEditActionDocument(nodes, nodeId)
}

/** Updates downstream conditions without changing facts, source requirements or the conversation. */
export function updateActionAgreement(nodes: ActionNode[], nodeId: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>): ActionNode[] {
  return updateActionDocument(nodes, nodeId, 'agreementMarkdown', markdown, editor)
}
