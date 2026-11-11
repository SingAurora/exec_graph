import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { actionFromView, actionKeys, type ActionContextNode, type VersionedAction } from '../../entities/action/api/context'
import { useAuthStore } from '../../features/auth/model/auth-store'
import { followingKeys } from '../../entities/following/api/following'
import { createGraph, removeGraph, updateGraph } from '../../features/graph/api/commands'
import { createAction, deleteAction, reviseAgreement, reviseExpression } from '../../features/action/api/commands'
import { publishNodeDocument } from '../../features/action-generation/api/generation'
import { setFollowing } from '../../features/follow/api/commands'
import { updateProfile } from '../../features/profile/api/commands'

// 同一内容的失败重试复用幂等键，避免服务已写入、响应却丢失时创建两份记录。
function submissionKey(current: { fingerprint: string; key: string } | undefined, input: unknown) {
  const fingerprint = JSON.stringify(input)
  return current?.fingerprint === fingerprint ? current : { fingerprint, key: crypto.randomUUID() }
}

/** 集中装配 mutation（写入操作）；只把服务已确认的数据更新到 Query 缓存。 */
export function useAppCommands(scope: string) {
  const client = useQueryClient()
  // useRef 跨渲染保留值，修改 .current 不触发重绘；这里保留尚未确认成功的提交身份。
  const graphSubmission = useRef<{ fingerprint: string; key: string }>(undefined)
  const actionSubmission = useRef<{ fingerprint: string; key: string }>(undefined)
  // 先用响应替换当前账号相关缓存里的节点，再标记失效，让活跃查询与服务重新对齐。
  const updateNode = (view: ActionContextNode) => {
    const node = actionFromView(view)
    client.setQueryData<VersionedAction[]>(actionKeys.context(scope, node.graphUuid), (nodes) =>
      nodes ? [node, ...nodes.filter((item) => item.uuid !== node.uuid)] : nodes,
    )
    void client.invalidateQueries({ queryKey: actionKeys.scope(scope) })
  }
  // mutationFn 发起请求；onSuccess 仅在成功后执行。界面等待 mutateAsync 后才清理草稿。
  const graphCreate = useMutation({ mutationFn: (input: Parameters<typeof createGraph>[0]) => {
    graphSubmission.current = submissionKey(graphSubmission.current, input)
    return createGraph(input, { idempotencyKey: graphSubmission.current.key })
  }, onSuccess() {
    graphSubmission.current = undefined
    void client.invalidateQueries({ queryKey: ['graphs', scope] })
  } })
  const graphUpdate = useMutation({ mutationFn: (input: Parameters<typeof updateGraph>[0]) => updateGraph(input, {}), onSuccess() {
    void client.invalidateQueries({ queryKey: ['graphs', scope] })
  } })
  const graphDelete = useMutation({ mutationFn: (input: Parameters<typeof removeGraph>[0]) => removeGraph(input, {}), onSuccess(_data, input) {
    void client.invalidateQueries({ queryKey: ['graphs', scope] })
    client.setQueriesData<VersionedAction[]>({ queryKey: actionKeys.scope(scope) }, (nodes) => nodes?.filter((node) => node.graphUuid !== input.graphUuid))
    void client.invalidateQueries({ queryKey: followingKeys.sources(scope) })
  } })
  const actionCreate = useMutation({ mutationFn: (input: Parameters<typeof createAction>[0]) => {
    actionSubmission.current = submissionKey(actionSubmission.current, input)
    return createAction(input, { idempotencyKey: actionSubmission.current.key })
  }, onSuccess(node) { actionSubmission.current = undefined; updateNode(node) } })
  const expressionUpdate = useMutation({ mutationFn: (input: Parameters<typeof reviseExpression>[0]) => reviseExpression(input, {}), onSuccess: updateNode })
  const agreementUpdate = useMutation({ mutationFn: (input: Parameters<typeof reviseAgreement>[0]) => reviseAgreement(input, {}), onSuccess: updateNode })
  const actionDelete = useMutation({ mutationFn: (input: { nodeUuid: string; expectedVersion: number }) => deleteAction(input, {}), onSuccess(_data, input) {
    client.setQueriesData<VersionedAction[]>({ queryKey: actionKeys.scope(scope) }, (nodes) => nodes?.filter((node) => node.uuid !== input.nodeUuid))
    void client.invalidateQueries({ queryKey: actionKeys.scope(scope) })
  } })
  const nodeDocumentPublish = useMutation({ mutationFn: (input: { nodeUuid: string; expectedVersion: number; kind: 'expression' | 'agreement' }) => publishNodeDocument(input.nodeUuid, input.expectedVersion, input.kind), onSuccess: updateNode })
  const followUpdate = useMutation({ mutationFn: (input: Parameters<typeof setFollowing>[0]) => setFollowing(input, {}), onSuccess(sources) { client.setQueryData(followingKeys.sources(scope), sources) } })
  const profileUpdate = useMutation({ mutationFn: (input: Parameters<typeof updateProfile>[0]) => updateProfile(input, {}), onSuccess(user) {
    useAuthStore.getState().setUser(user)
    // 作者摘要已经随行动返回；资料变化后重新读取行动上下文。
    void client.invalidateQueries({ queryKey: actionKeys.scope(scope) })
  } })
  return { graphCreate, graphUpdate, graphDelete, actionCreate, actionDelete, expressionUpdate, agreementUpdate, nodeDocumentPublish, followUpdate, profileUpdate }
}
