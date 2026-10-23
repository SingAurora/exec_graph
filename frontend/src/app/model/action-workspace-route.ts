/** 工作区地址：记录新行动与修改已有表达使用不同参数，不依赖临时组件状态识别目标。 */
export type ActionWorkspaceRoute = { projectId: string } & (
  { mode: 'action'; parentId?: string } | { mode: 'expression'; nodeId: string }
)

/** 从 URL 恢复编辑目标，使刷新和浏览器后退仍能找到同一工作区。 */
export function readActionWorkspaceRoute(params: URLSearchParams): ActionWorkspaceRoute | undefined {
  const projectId = params.get('projectId')
  if (!projectId) return undefined
  if (params.get('mode') === 'expression') {
    const nodeId = params.get('nodeId')
    return nodeId ? { projectId, mode: 'expression', nodeId } : undefined
  }
  if (params.get('mode') !== 'action') return undefined
  return { projectId, mode: 'action', parentId: params.get('parentId') || undefined }
}

/** 生成工作区地址；URL 只保存目标标识，私人对话和草稿正文不进入地址。 */
export function actionWorkspaceHash(target: ActionWorkspaceRoute): string {
  const params = new URLSearchParams({ projectId: target.projectId, mode: target.mode })
  if (target.mode === 'expression') params.set('nodeId', target.nodeId)
  else if (target.parentId) params.set('parentId', target.parentId)
  return 'publish?' + params.toString()
}
