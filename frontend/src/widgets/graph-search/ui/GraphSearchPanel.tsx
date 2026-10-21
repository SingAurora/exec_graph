import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import type { ActionReference } from '../../../entities/action/lib/references'
import { searchGraphAgreementResponses, searchGraphDocuments, searchGraphParticipants } from '../../../features/search-graph/lib/search'
import type { GraphSearchCriteria, GraphSearchScope } from '../../../features/search-graph/model/types'
import { GraphSearchForm } from '../../../features/search-graph/ui/GraphSearchForm'
import type { UserProfile } from '../../../entities/profile/model/types'
import { Pagination } from '../../../shared/ui/Pagination'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { UserSearchResults } from './UserSearchResults'

type Props = {
  scope: GraphSearchScope
  projectId: string
  active: boolean
  actions: ActionNode[]
  users: UserProfile[]
  filterUsers: UserProfile[]
  onExplore: (node: ActionNode, mode: ActionDocumentMode) => void
  onExploreReference: (reference: ActionReference) => void
}

const pageSize = 6
const labels: Record<GraphSearchScope, string> = { expressions: '表达', agreements: '约定', actions: '行动', users: '用户' }

/** Owns one category's draft, submitted criteria, pagination and retained result components. */
export function GraphSearchPanel({ scope, projectId, active, actions, users, filterUsers, onExplore, onExploreReference }: Props) {
  const [draft, setDraft] = useState<GraphSearchCriteria>({ keyword: '' })
  const [submitted, setSubmitted] = useState<GraphSearchCriteria | null>(null)
  const [page, setPage] = useState(1)
  const resultsRef = useRef<HTMLParagraphElement>(null)
  const pendingFocus = useRef(false)
  const mode = scope === 'expressions' ? 'expression' : 'objective'
  const documents = useMemo(() => submitted && (scope === 'expressions' || scope === 'actions')
    ? searchGraphDocuments(actions, projectId, submitted.keyword, mode, submitted.authorId) : [], [actions, projectId, submitted, mode, scope])
  const agreements = useMemo(() => submitted && scope === 'agreements'
    ? searchGraphAgreementResponses(actions, projectId, submitted) : [], [actions, projectId, submitted, scope])
  const participants = useMemo(() => submitted && scope === 'users'
    ? searchGraphParticipants(actions, users, projectId, submitted.keyword) : [], [actions, users, projectId, submitted, scope])
  const actionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const action of actions) if (action.projectId === projectId) counts.set(action.authorId, (counts.get(action.authorId) ?? 0) + 1)
    return counts
  }, [actions, projectId])
  const count = scope === 'users' ? participants.length : scope === 'agreements' ? agreements.length : documents.length
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * pageSize

  useLayoutEffect(() => {
    if (!active || !pendingFocus.current) return
    pendingFocus.current = false
    const frame = requestAnimationFrame(() => {
      const results = resultsRef.current
      if (!results) return
      results.focus({ preventScroll: true })
      const bounds = results.getBoundingClientRect()
      if (bounds.top < 44 || bounds.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + bounds.top - 60, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [active, submitted, currentPage])

  const submit = () => {
    pendingFocus.current = true
    setPage(1)
    setSubmitted({ ...draft, keyword: draft.keyword.trim() })
  }
  const reset = () => { setDraft({ keyword: '' }); setSubmitted(null); setPage(1); pendingFocus.current = false }
  const changePage = (next: number) => {
    if (next === currentPage || next < 1 || next > pageCount) return
    pendingFocus.current = true
    setPage(next)
  }

  return <div className="pt-4">
    <GraphSearchForm scope={scope} criteria={draft} users={filterUsers} onChange={setDraft} onSubmit={submit} onReset={reset} />
    {submitted && <>
      <p ref={resultsRef} tabIndex={-1} className="mt-5 text-xs leading-5 text-muted outline-none" role="status">找到 {count} {scope === 'users' ? '位参与用户' : `条${labels[scope]}`}</p>
      {!count ? <p className="py-12 text-center text-sm text-muted">没有找到相关{labels[scope]}</p>
        : scope === 'agreements' ? <AgreementResponseList references={agreements.slice(startIndex, startIndex + pageSize)} users={users} infinite={false} active={active} searchQuery={submitted.keyword} onExplore={onExploreReference} />
          : scope === 'users' ? <UserSearchResults users={participants.slice(startIndex, startIndex + pageSize)} projectId={projectId} actionCounts={actionCounts} query={submitted.keyword} />
            : <ActionPostList nodes={documents.slice(startIndex, startIndex + pageSize)} actions={actions} users={users} mode={mode} onExplore={onExplore} searchQuery={submitted.keyword} />}
      {pageCount > 1 && <Pagination label="搜索结果分页" currentPage={currentPage} pageCount={pageCount} onChange={changePage} />}
    </>}
  </div>
}
