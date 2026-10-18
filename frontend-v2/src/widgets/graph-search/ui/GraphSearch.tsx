import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { searchGraphDocuments, searchGraphParticipants } from '../../../features/search-graph/lib/search'
import { GraphSearchForm, type GraphSearchScope } from '../../../features/search-graph/ui/GraphSearchForm'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { ActionPostList } from '../../action-posts/ui/ActionPostList'

type GraphSearchProps = {
  projectId: string
  actions: ActionNode[]
  users: UserProfile[]
  onExplore: (node: ActionNode, mode: ActionDocumentMode) => void
}

/** Keeps graph search criteria and results while readers visit a document or participant profile. */
export function GraphSearch({ projectId, actions, users, onExplore }: GraphSearchProps) {
  const [scope, setScope] = useState<GraphSearchScope>('expressions')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const scrollPositions = useRef<Partial<Record<GraphSearchScope, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const mode = scope === 'expressions' ? 'expression' : 'objective'
  const documents = useMemo(() => scope === 'users' ? [] : searchGraphDocuments(actions, projectId, query, mode), [actions, projectId, query, mode, scope])
  const participants = useMemo(() => scope === 'users' ? searchGraphParticipants(actions, users, projectId, query) : [], [actions, users, projectId, query, scope])
  const label = scope === 'users' ? '参与用户' : scope === 'expressions' ? '表达' : '行动'
  const count = scope === 'users' ? participants.length : documents.length

  useLayoutEffect(() => {
    if (pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [scope])

  const changeScope = (next: GraphSearchScope) => {
    if (next === scope) return
    scrollPositions.current[scope] = window.scrollY
    pendingScroll.current = scrollPositions.current[next] ?? 0
    setScope(next)
  }
  const submit = () => {
    if (draft.trim() === query) return
    scrollPositions.current = {}
    setQuery(draft.trim())
  }
  const clear = () => { setDraft(''); setQuery(''); scrollPositions.current = {} }

  return <section className="min-w-0" aria-label="图内搜索结果">
    <GraphSearchForm scope={scope} value={draft} onValueChange={setDraft} onScopeChange={changeScope} onSubmit={submit} onClear={clear} />
    {query && <>
      <p className="mt-5 text-xs leading-5 text-muted" role="status">找到 {count} {scope === 'users' ? '位参与用户' : `条${label}`}</p>
      {count === 0 ? <p className="py-12 text-center text-sm text-muted">没有找到相关{label}</p>
        : scope !== 'users' ? <ActionPostList nodes={documents} actions={actions} users={users} mode={mode} onExplore={onExplore} searchQuery={query} />
          : <ul className="mt-2 divide-y divide-line" aria-label="参与用户搜索结果">
            {participants.map((user) => <li key={user.id}>
              <a className="flex items-start gap-3 rounded-sm px-1 py-5 hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`#profile?userId=${encodeURIComponent(user.id)}&fromGraph=${encodeURIComponent(projectId)}`} aria-label={`查看${user.name}的主页`}>
                <Avatar profile={user} size="medium" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium leading-5 text-ink"><HighlightedText text={user.name} query={query} /></h3>
                  {user.bio && <p className="mt-1 line-clamp-2 text-sm leading-[1.7] text-copy">{user.bio}</p>}
                  <p className="mt-2 text-xs text-muted">在本图记录了 {actions.filter((node) => node.projectId === projectId && node.authorId === user.id).length} 次行动</p>
                </div>
              </a>
            </li>)}
          </ul>}
    </>}
  </section>
}
