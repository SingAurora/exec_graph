/** 工作区地址：记录新行动与修改已有表达使用不同参数，不依赖临时组件状态识别目标。 */
export type ActionWorkspaceRoute = { graphUuid: string } & (
  { mode: 'action'; parentUuid?: string } | { mode: 'expression'; nodeUuid: string } | { mode: 'agreement'; nodeUuid: string }
)

/** 从 URL 恢复编辑目标，使刷新和浏览器后退仍能找到同一工作区。 */
export function readActionWorkspaceRoute(params: URLSearchParams): ActionWorkspaceRoute | undefined {
  const graphUuid = params.get('graphUuid')
  if (!graphUuid) return undefined
  if (params.get('mode') === 'expression' || params.get('mode') === 'agreement') {
    const nodeUuid = params.get('nodeUuid')
    return nodeUuid ? { graphUuid, mode: params.get('mode') as 'expression' | 'agreement', nodeUuid } : undefined
  }
  if (params.get('mode') !== 'action') return undefined
  return { graphUuid, mode: 'action', parentUuid: params.get('parentUuid') || undefined }
}

/** 生成工作区地址；URL 只保存目标标识，私人对话和草稿正文不进入地址。 */
export function actionWorkspaceHash(target: ActionWorkspaceRoute): string {
  const params = new URLSearchParams({ graphUuid: target.graphUuid, mode: target.mode })
  if (target.mode === 'expression' || target.mode === 'agreement') params.set('nodeUuid', target.nodeUuid)
  else if (target.parentUuid) params.set('parentUuid', target.parentUuid)
  return 'publish?' + params.toString()
}
