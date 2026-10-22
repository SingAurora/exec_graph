import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { actionFromView, actionKeys, type ActionContextNode, type VersionedAction } from '../../entities/action/api/context'
import { graphKeys, type GraphView } from '../../entities/project/api/graphs'
import { profileKeys, type SessionView } from '../../entities/profile/api/profiles'
import { followingKeys } from '../../entities/following/api/following'
import { createGraph, removeGraph, updateGraph } from '../../features/project/api/commands'
import { createAction, reviseAgreement, reviseExpression } from '../../features/action/api/commands'
import { setFollowing } from '../../features/follow/api/commands'
import { updateProfile } from '../../features/profile/api/commands'

function submissionKey(current: { fingerprint: string; key: string } | undefined, input: unknown) {
  const fingerprint = JSON.stringify(input)
  return current?.fingerprint === fingerprint ? current : { fingerprint, key: crypto.randomUUID() }
}

/** Executes explicit remote writes and updates only server-confirmed Query data. */
export function useAppCommands(scope: string, csrfToken: string) {
  const client = useQueryClient()
  const graphSubmission = useRef<{ fingerprint: string; key: string }>(undefined)
  const actionSubmission = useRef<{ fingerprint: string; key: string }>(undefined)
  const options = { csrfToken }
  const updateNode = (view: ActionContextNode) => {
    const node = actionFromView(view)
    for (const query of client.getQueryCache().findAll({ queryKey: actionKeys.scope(scope) })) {
      const ids = query.queryKey[3]
      if (!Array.isArray(ids) || !ids.includes(node.projectId)) continue
      client.setQueryData<VersionedAction[]>(query.queryKey, (nodes) => nodes ? [node, ...nodes.filter((item) => item.id !== node.id)] : nodes)
    }
    void client.invalidateQueries({ queryKey: actionKeys.scope(scope) })
  }
  const graphCreate = useMutation({ mutationFn: (input: Parameters<typeof createGraph>[0]) => {
    graphSubmission.current = submissionKey(graphSubmission.current, input)
    return createGraph(input, { ...options, idempotencyKey: graphSubmission.current.key })
  }, onSuccess(graph) {
    graphSubmission.current = undefined
    client.setQueryData<GraphView[]>(graphKeys.catalogue(scope), (graphs) => [graph, ...(graphs ?? []).filter((item) => item.id !== graph.id)])
  } })
  const graphUpdate = useMutation({ mutationFn: (input: Parameters<typeof updateGraph>[0]) => updateGraph(input, options), onSuccess(graph) {
    client.setQueryData<GraphView[]>(graphKeys.catalogue(scope), (graphs) => graphs?.map((item) => item.id === graph.id ? graph : item))
  } })
  const graphDelete = useMutation({ mutationFn: (input: Parameters<typeof removeGraph>[0]) => removeGraph(input, options), onSuccess(_data, input) {
    client.setQueryData<GraphView[]>(graphKeys.catalogue(scope), (graphs) => graphs?.filter((item) => item.id !== input.graphId))
    client.setQueriesData<VersionedAction[]>({ queryKey: actionKeys.scope(scope) }, (nodes) => nodes?.filter((node) => node.projectId !== input.graphId))
    void client.invalidateQueries({ queryKey: followingKeys.sources(scope) })
  } })
  const actionCreate = useMutation({ mutationFn: (input: Parameters<typeof createAction>[0]) => {
    actionSubmission.current = submissionKey(actionSubmission.current, input)
    return createAction(input, { ...options, idempotencyKey: actionSubmission.current.key })
  }, onSuccess(node) { actionSubmission.current = undefined; updateNode(node) } })
  const expressionUpdate = useMutation({ mutationFn: (input: Parameters<typeof reviseExpression>[0]) => reviseExpression(input, options), onSuccess: updateNode })
  const agreementUpdate = useMutation({ mutationFn: (input: Parameters<typeof reviseAgreement>[0]) => reviseAgreement(input, options), onSuccess: updateNode })
  const followUpdate = useMutation({ mutationFn: (input: Parameters<typeof setFollowing>[0]) => setFollowing(input, options), onSuccess(sources) { client.setQueryData(followingKeys.sources(scope), sources) } })
  const profileUpdate = useMutation({ mutationFn: (input: Parameters<typeof updateProfile>[0]) => updateProfile(input, options), onSuccess(user) {
    client.setQueryData<SessionView>(profileKeys.session, (session) => session ? { ...session, user } : session)
    void client.invalidateQueries({ queryKey: profileKeys.catalogue(scope) })
  } })
  return { graphCreate, graphUpdate, graphDelete, actionCreate, expressionUpdate, agreementUpdate, followUpdate, profileUpdate }
}
