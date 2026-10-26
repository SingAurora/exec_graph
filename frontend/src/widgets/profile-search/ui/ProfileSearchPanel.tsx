import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { filterAgreementParticipants, getReferenceAgreementAuthorId } from '../../../entities/action/lib/agreement-responses'
import { searchActions, searchAgreementResponses, searchExpressions } from '../../../entities/action/lib/search'
import type { ActionReference } from '../../../entities/action/lib/references'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getGraphActivity } from '../../../entities/project/lib/activity'
import { searchProjects } from '../../../entities/project/lib/search'
import type { ProfileSearchCriteria, ProfileSearchScope } from '../../../features/search-profile/model/types'
import { ProfileSearchForm } from '../../../features/search-profile/ui/ProfileSearchForm'
import type { Project } from '../../../entities/project/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { Pagination } from '../../../shared/ui/Pagination'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'
import { AgreementResponseList } from '../../agreement-responses/ui/AgreementResponseList'
import { GraphList } from '../../graphs/GraphList'

type Props = {
  scope: ProfileSearchScope
  active: boolean
  expressions: ActionNode[]
  actions: ActionNode[]
  allActions: ActionNode[]
  references?: ActionReference[]
  graphs?: Project[]
  users: UserProfile[]
  profileId?: string
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
  onOpenReference?: (reference: ActionReference) => void
  onOpenProject: (id: string) => void
  renderContext: (node: ActionNode) => ReactNode
}
const pageSize = 6
const labels: Record<ProfileSearchScope, string> = { expressions: '表达', agreements: '约定', actions: '行动', graphs: '图' }
const emptyCriteria: ProfileSearchCriteria = { keyword: '', counterpartId: '' }

/** Retains one category's draft, submitted results and page without filtering the normal profile lists. */
export function ProfileSearchPanel({ scope, active, expressions, actions, allActions, references, graphs, users, profileId, onOpenNode, onOpenReference, onOpenProject, renderContext }: Props) {
  const [draft, setDraft] = useState(emptyCriteria)
  const [submitted, setSubmitted] = useState<ProfileSearchCriteria | null>(null)
  const [page, setPage] = useState(1)
  const resultsRef = useRef<HTMLParagraphElement>(null)
  const pendingFocus = useRef(false)
  const documents = useMemo(() => !submitted ? [] : scope === 'expressions'
    ? searchExpressions(expressions, allActions, users, submitted.keyword)
    : scope === 'actions' ? searchActions(actions, users, submitted.keyword) : [], [scope, submitted, expressions, actions, allActions, users])
  const agreements = useMemo(() => submitted && scope === 'agreements'
    ? searchAgreementResponses(filterAgreementParticipants(references ?? [], profileId, submitted.counterpartId), users, submitted.keyword) : [], [submitted, scope, references, profileId, users])
  const graphMatches = useMemo(() => submitted && scope === 'graphs' ? searchProjects(graphs ?? [], submitted.keyword) : [], [submitted, scope, graphs])
  const counterpartOptions = useMemo(() => [...new Set((references ?? []).flatMap((reference) => [reference.target.authorId, getReferenceAgreementAuthorId(reference)]))]
    .filter((id) => id !== profileId)
    .map((id) => ({ value: id, label: users.find((user) => user.id === id)?.name ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')), [references, profileId, users])
  const count = scope === 'graphs' ? graphMatches.length : scope === 'agreements' ? agreements.length : documents.length
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize

  useLayoutEffect(() => {
    if (!active || !pendingFocus.current) return
    pendingFocus.current = false
    const results = resultsRef.current
    if (!results) return
    results.focus({ preventScroll: true })
    const bounds = results.getBoundingClientRect()
    if (bounds.top < 60 || bounds.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + bounds.top - 60, behavior: 'instant' })
  }, [active, submitted, currentPage])

  return (
    <div className="pt-4">
      <ProfileSearchForm scope={scope} criteria={draft} counterpartOptions={counterpartOptions} onChange={setDraft}
        onSubmit={() => { pendingFocus.current = true; setPage(1); setSubmitted({ ...draft, keyword: draft.keyword.trim() }) }}
        onReset={() => { setDraft(emptyCriteria); setSubmitted(null); setPage(1); pendingFocus.current = false }} />
      {submitted && <>
        <p ref={resultsRef} tabIndex={-1} className="mt-5 text-xs leading-5 text-muted outline-none" role="status">找到 {count} {scope === 'graphs' ? '个' : '条'}{labels[scope]}</p>
        {!count ? <p className="py-12 text-center text-sm text-muted">没有找到相关{labels[scope]}</p>
          : scope === 'graphs' ? <GraphList items={graphMatches.slice(start, start + pageSize).map((project) => getGraphActivity(project, allActions))} searchQuery={submitted.keyword} onOpen={onOpenProject} dividers={false} />
            : scope === 'agreements' && onOpenReference ? <AgreementResponseList references={agreements.slice(start, start + pageSize)} users={users} active={active} infinite={false} presentation="feed" searchQuery={submitted.keyword} onExplore={onOpenReference} renderContext={(reference) => renderContext(reference.target)} />
              : <ActionPostList nodes={documents.slice(start, start + pageSize)} actions={allActions} users={users} mode={scope === 'expressions' ? 'expression' : 'objective'} presentation={scope === 'expressions' ? 'feed' : 'default'} searchQuery={submitted.keyword} onExplore={onOpenNode} renderContext={renderContext} />}
        {pageCount > 1 && <Pagination label="主页搜索分页" currentPage={currentPage} pageCount={pageCount} onChange={(next) => { pendingFocus.current = true; setPage(next) }} />}
      </>}
    </div>
  )
}
