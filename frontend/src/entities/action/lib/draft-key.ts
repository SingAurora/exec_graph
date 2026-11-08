/** 草稿键按账号、图、操作和目标节点隔离，避免不同编辑器互相覆盖。 */
export function getActionDraftKey(accountUuid: string, graphUuid: string, kind: 'action' | 'expression' | 'agreement', nodeUuid?: string): string {
  return JSON.stringify(['action-draft', 1, accountUuid, graphUuid, kind, nodeUuid ?? null])
}
