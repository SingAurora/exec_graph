/** 草稿键按账号、图、操作和目标节点隔离，避免不同编辑器互相覆盖。 */
export function getActionDraftKey(accountId: string, projectId: string, kind: 'action' | 'expression' | 'agreement', nodeId?: string): string {
  return JSON.stringify(['action-draft', 1, accountId, projectId, kind, nodeId ?? null])
}
