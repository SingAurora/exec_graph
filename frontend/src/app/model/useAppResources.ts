import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { graphKeys, readGraphCatalogue } from '../../entities/project/api/graphs'
import { actionKeys, readActionContexts } from '../../entities/action/api/context'
import { profileKeys, readProfileCatalogue, readSession } from '../../entities/profile/api/profiles'
import { followingKeys, readFollowing } from '../../entities/following/api/following'

/** Reads server facts into Query only, adapting complete contexts for the retained prototype selectors. */
export function useAppResources() {
  const session = useQuery({ queryKey: profileKeys.session, queryFn: ({ signal }) => readSession(signal) })
  const scope = session.data?.user.id ?? 'anonymous'
  const enabled = Boolean(session.data?.user)
  const graphs = useQuery({ queryKey: graphKeys.catalogue(scope), queryFn: ({ signal }) => readGraphCatalogue(signal), enabled })
  const users = useQuery({ queryKey: profileKeys.catalogue(scope), queryFn: ({ signal }) => readProfileCatalogue(signal), enabled })
  const following = useQuery({ queryKey: followingKeys.sources(scope), queryFn: ({ signal }) => readFollowing(signal), enabled })
  const graphIds = graphs.data?.map((graph) => graph.id) ?? []
  const contexts = useQuery({ queryKey: actionKeys.contexts(scope, graphIds), queryFn: ({ signal }) => readActionContexts(graphIds, signal),
    enabled: enabled && Boolean(graphs.data), placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined })
  const profile = session.data?.user
  const allUsers = useMemo(() => profile && users.data ? [profile, ...users.data.filter((user) => user.id !== profile.id).map((user) => ({ ...user, email: '' }))] : [], [profile, users.data])
  const error = session.error ?? graphs.error ?? users.error ?? following.error ?? contexts.error
  const ready = Boolean(profile && graphs.data && users.data && following.data && contexts.data)
  const retry = () => { void session.refetch(); if (enabled) { void graphs.refetch(); void users.refetch(); void following.refetch(); if (graphs.data) void contexts.refetch() } }
  return { profile, projects: graphs.data, actions: contexts.data, allUsers, sources: following.data, csrfToken: session.data?.csrfToken, scope, ready, error, retry }
}
