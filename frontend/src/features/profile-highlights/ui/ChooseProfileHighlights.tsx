import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileKeys } from '../../../entities/profile/api/profiles'
import { useAuthStore } from '../../auth/model/auth-store'
import type { ProfileHighlights } from '../../../entities/profile/model/types'
import { profileHighlightLimit } from '../../../entities/profile/model/highlights'
import type { ProfileHighlightEntry } from '../../../entities/action/lib/profile-highlights'
import type { Graph } from '../../../entities/graph/model/types'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { getSearchExcerpt } from '../../../shared/lib/search'
import { HighlightedText } from '../../../shared/ui/HighlightedText'
import { setProfileHighlights } from '../api/commands'
import { HighlightCandidates } from './HighlightCandidates'

/** 主页精选的唯一管理入口；添加、移出和排序都只修改草稿，保存后统一生效。 */
export function ChooseProfileHighlights({ userUuid, highlights, candidates, graphs, returnFocusRef, onClose }: {
  userUuid: string
  highlights?: ProfileHighlights
  candidates: ProfileHighlightEntry[]
  graphs: Graph[]
  returnFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => [...new Set(highlights?.expressionNodeUuids ?? [])].filter((id) => candidates.some(({ node }) => node.uuid === id)).slice(0, profileHighlightLimit))
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const selected = draft.flatMap((id) => candidates.filter(({ node }) => node.uuid === id))
  const available = candidates.filter(({ node }) => !draft.includes(node.uuid))
  const currentUser = useAuthStore((state) => state.user)
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      if (!currentUser || currentUser.uuid !== userUuid) throw new Error('当前账户已变化，请重新打开主页')
      return setProfileHighlights({ expressionNodeUuids: draft, expectedVersion: currentUser.version }, {})
    },
    onSuccess(user) {
      useAuthStore.getState().setUser(user)
      void client.invalidateQueries({ queryKey: profileKeys.catalogue(userUuid) })
      onClose()
    },
    onError() {
      // 保留本次选择；账户变化后重新打开主页，不能用旧版本静默覆盖资料。
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
    <p className="text-xs text-muted"><HighlightedText text={graphs.find((graph) => graph.uuid === node.graphUuid)?.title ?? node.graphUuid} query={keyword} /> · #{node.number}</p>
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
            <ol className="divide-y divide-line">{selected.map((entry, index) => <li key={entry.node.uuid} className="py-3">
              <div className="flex items-start gap-3"><span className="w-4 shrink-0 text-sm tabular-nums text-muted">{index + 1}</span>{describe(entry)}</div>
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="icon-button" title="上移" disabled={index === 0} onClick={() => move(entry.node.uuid, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="icon-button" title="下移" disabled={index === selected.length - 1} onClick={() => move(entry.node.uuid, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="icon-button" title="移出精选" onClick={() => { setDraft((current) => current.filter((id) => id !== entry.node.uuid)); addRef.current?.focus() }}><Trash2 size={16} /></button>
              </div>
            </li>)}</ol>
          </section>
          <HighlightCandidates active={adding} candidates={available} graphs={graphs} full={draft.length >= profileHighlightLimit} renderEntry={describe} onAdd={(id) => { setDraft((current) => current.length < profileHighlightLimit && !current.includes(id) ? [...current, id] : current); addRef.current?.focus() }} />
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="quiet-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={!currentUser || currentUser.uuid !== userUuid || save.isPending} onClick={() => { if (!save.isPending && currentUser?.uuid === userUuid) save.mutate() }}>{save.isPending ? '保存中…' : '保存精选'}</button></div>
        </fieldset>
        {save.error && <p className="mt-3 text-xs text-coral">{save.error.message}</p>}
      </div>
    </Dialog>
  )
}
