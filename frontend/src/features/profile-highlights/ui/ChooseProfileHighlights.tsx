import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileKeys, readSession, type SessionView } from '../../../entities/profile/api/profiles'
import type { ProfileHighlights } from '../../../entities/profile/model/types'
import { profileHighlightLimit } from '../../../entities/profile/model/highlights'
import type { ProfileHighlightEntry } from '../../../entities/action/lib/profile-highlights'
import type { Project } from '../../../entities/project/model/types'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { useToast } from '../../../shared/ui/toast/useToast'
import { setProfileHighlights } from '../api/commands'
import { HighlightCandidates } from './HighlightCandidates'

/** 主页精选的唯一管理入口；添加、移出和排序都只修改草稿，保存后统一生效。 */
export function ChooseProfileHighlights({ userId, highlights, candidates, projects, returnFocusRef, onClose }: {
  userId: string
  highlights?: ProfileHighlights
  candidates: ProfileHighlightEntry[]
  projects: Project[]
  returnFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => [...new Set(highlights?.expressionNodeIds ?? [])].filter((id) => candidates.some(({ node }) => node.id === id)).slice(0, profileHighlightLimit))
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const selected = draft.flatMap((id) => candidates.filter(({ node }) => node.id === id))
  const available = candidates.filter(({ node }) => !draft.includes(node.id))
  const session = useQuery({ queryKey: profileKeys.session, queryFn: ({ signal }) => readSession(signal) })
  const client = useQueryClient()
  const { showToast } = useToast()
  const save = useMutation({
    mutationFn: async () => {
      if (!session.data || session.data.user.id !== userId) throw new Error('当前账户已变化，请重新打开主页')
      return setProfileHighlights({ expressionNodeIds: draft, expectedVersion: session.data.user.version }, { csrfToken: session.data.csrfToken })
    },
    onSuccess(user) {
      client.setQueryData<SessionView>(profileKeys.session, (current) => current?.user.id === user.id ? { ...current, user } : current)
      void client.invalidateQueries({ queryKey: profileKeys.catalogue(userId) })
      showToast({ kind: 'info', message: '主页精选已保存' })
      onClose()
    },
    onError() {
      // 保留本次选择；刷新版本后可重试，不能用旧账户版本静默覆盖资料。
      if (client.getQueryData<SessionView>(profileKeys.session)?.user.id === userId) void client.invalidateQueries({ queryKey: profileKeys.session })
    },
  })
  const move = (id: string, offset: number) => setDraft((current) => {
    const index = current.indexOf(id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= current.length) return current
    const next = [...current]
    const moved = next[index]
    next[index] = next[target]
    next[target] = moved
    return next
  })
  const describe = ({ node, markdown, agreement }: ProfileHighlightEntry, keyword = '') => <div className="min-w-0 flex-1">
    <p className="text-xs text-muted"><HighlightedText text={projects.find((project) => project.id === node.projectId)?.title ?? node.projectId} query={keyword} /> · #{node.number}</p>
    <p className="mt-1 break-words text-sm font-medium leading-6"><HighlightedText text={node.title} query={keyword} /></p>
    <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-copy"><HighlightedText text={getSearchExcerpt(getMarkdownSummary(markdown), keyword)} query={keyword} /></p>
    {agreement.markdown.trim() && <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted">分支约定：<HighlightedText text={getSearchExcerpt(getMarkdownSummary(agreement.markdown), keyword)} query={keyword} /></p>}
  </div>

  return (
    <Dialog open title="编辑主页精选" description="最多选择五个表达，附带所在分支的约定。添加、移出和排序在保存后生效。" className="w-[min(calc(100%-32px),640px)] rounded-lg p-6" returnFocusRef={returnFocusRef} onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
      <div className="mt-5">
        <fieldset disabled={save.isPending} className="contents">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><span className="text-xs tabular-nums text-muted">已选 {draft.length} / {profileHighlightLimit}</span>
            <button ref={addRef} type="button" className="text-button text-sm" onClick={() => { scrollRef.current?.scrollTo({ top: 0 }); setAdding((current) => !current) }}>{adding ? <ArrowLeft size={15} /> : <Plus size={15} />}{adding ? '返回已选' : '添加表达'}</button>
          </div>
          {draft.length >= profileHighlightLimit && <p className="mb-2 text-xs text-muted">已选满 5 个，可先移出再添加</p>}
          <section ref={scrollRef} hidden={adding} className="max-h-[50dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-4 [scrollbar-gutter:stable]">
            <h3 className="text-sm font-semibold">精选表达</h3>
            {!selected.length && <p className="py-5 text-sm text-muted">尚未精选表达</p>}
            <ol className="divide-y divide-line">{selected.map((entry, index) => <li key={entry.node.id} className="py-3">
              <div className="flex items-start gap-3"><span className="w-4 shrink-0 text-sm tabular-nums text-muted">{index + 1}</span>{describe(entry)}</div>
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="icon-button" title="上移" disabled={index === 0} onClick={() => move(entry.node.id, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="icon-button" title="下移" disabled={index === selected.length - 1} onClick={() => move(entry.node.id, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="icon-button" title="移出精选" onClick={() => { setDraft((current) => current.filter((id) => id !== entry.node.id)); addRef.current?.focus() }}><Trash2 size={16} /></button>
              </div>
            </li>)}</ol>
          </section>
          <HighlightCandidates active={adding} candidates={available} projects={projects} full={draft.length >= profileHighlightLimit} renderEntry={describe} onAdd={(id) => { setDraft((current) => current.length < profileHighlightLimit && !current.includes(id) ? [...current, id] : current); addRef.current?.focus() }} />
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="quiet-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={!session.data || session.data.user.id !== userId || session.isFetching} onClick={() => { if (!save.isPending && !session.isFetching && session.data?.user.id === userId) save.mutate() }}>{save.isPending ? '保存中…' : '保存精选'}</button></div>
        </fieldset>
        {(save.error || session.error) && <p className="mt-3 text-xs text-coral">{save.error?.message ?? session.error?.message}</p>}
      </div>
    </Dialog>
  )
}
