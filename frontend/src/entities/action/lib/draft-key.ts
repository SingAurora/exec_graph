/** Isolates unpublished edits by account, graph, operation and target node. */
export function getActionDraftKey(accountId: string, projectId: string, kind: 'action' | 'expression' | 'agreement', nodeId?: string): string {
  return JSON.stringify(['action-draft', 1, accountId, projectId, kind, nodeId ?? null])
}
