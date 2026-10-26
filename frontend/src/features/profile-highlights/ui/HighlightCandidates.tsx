import { Plus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import type { ProfileHighlightEntry } from '../../../entities/action/lib/profile-highlights'
import type { Project } from '../../../entities/project/model/types'
import { useInfiniteList } from '../../../shared/lib/useInfiniteList'
import { Pagination } from '../../../shared/ui/Pagination'
import { SearchInput } from '../../../shared/ui/SearchInput'
import { searchHighlightCandidates } from '../lib/search'

const searchPageSize = 6

/** 完整候选的添加列表：普通浏览逐批加载，显式搜索先筛选全量内容再分页；隐藏时暂停观察。 */
export function HighlightCandidates({ active, candidates, projects, full, onAdd, renderEntry }: {
  active: boolean
  candidates: ProfileHighlightEntry[]
  projects: Project[]
  full: boolean
  onAdd: (id: string) => void
  renderEntry: (entry: ProfileHighlightEntry, keyword?: string) => ReactNode
}) {
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const matches = searchHighlightCandidates(candidates, projects, keyword)
  const pageCount = Math.max(1, Math.ceil(matches.length / searchPageSize))
  const currentPage = Math.min(page, pageCount)
  const { visibleCount, endRef, hasMore } = useInfiniteList({ itemCount: matches.length, infinite: !keyword, active })
  const visible = keyword ? matches.slice((currentPage - 1) * searchPageSize, currentPage * searchPageSize) : matches.slice(0, visibleCount)
  const submit = (next: string) => {
    setKeyword(next.trim())
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <section id="highlight-candidates" hidden={!active} aria-label="可选表达">
      <form className="mb-3 flex items-center gap-2" aria-label="精选表达搜索" onSubmit={(event) => { event.preventDefault(); submit(input) }}>
        <div className="min-w-0 flex-1"><SearchInput size="wide" label="表达、行动、约定或图名" value={input} onChange={setInput} onClear={() => { setInput(''); submit('') }} /></div>
        <button type="submit" className="primary-button">搜索</button>
      </form>
      <p className="mb-2 text-xs text-muted" role="status">{keyword ? '搜索结果' : '可选表达'} · 共 {matches.length} 条</p>
      <div ref={scrollRef} className="max-h-[40dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-4 [scrollbar-gutter:stable]" aria-label="可选表达列表">
        {!matches.length && <p className="py-5 text-sm text-muted">{keyword ? '没有匹配的表达' : '暂无其他可选表达'}</p>}
        <ul className="divide-y divide-line">{visible.map((entry) => <li key={entry.node.id} className="py-3">
          {renderEntry(entry, keyword)}
          <div className="mt-2 flex justify-end"><button type="button" className="icon-button" aria-label={`添加表达：${entry.node.title}`} title="添加表达" disabled={full} onClick={() => onAdd(entry.node.id)}><Plus size={16} /></button></div>
        </li>)}</ul>
        {!keyword && <p ref={endRef} className="py-3 text-center text-xs text-muted" role="status">{hasMore ? '加载中…' : matches.length ? '已显示全部可选表达' : ''}</p>}
      </div>
      {keyword && pageCount > 1 && <Pagination currentPage={currentPage} pageCount={pageCount} label="精选表达搜索分页" onChange={(next) => { setPage(next); scrollRef.current?.scrollTo({ top: 0 }) }} />}
    </section>
  )
}
