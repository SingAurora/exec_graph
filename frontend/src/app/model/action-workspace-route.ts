/** Identifies an editor independently of transient application state. */
export type ActionWorkspaceRoute = { projectId: string } & (
  { mode: 'action'; parentId?: string } | { mode: 'expression'; nodeId: string }
)

/** Restores the same editor after refresh or browser-back navigation. */
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

/** Builds a shareable editor address without putting private draft contents into the URL. */
export function actionWorkspaceHash(target: ActionWorkspaceRoute): string {
  const params = new URLSearchParams({ projectId: target.projectId, mode: target.mode })
  if (target.mode === 'expression') params.set('nodeId', target.nodeId)
  else if (target.parentId) params.set('parentId', target.parentId)
  return 'publish?' + params.toString()
}
