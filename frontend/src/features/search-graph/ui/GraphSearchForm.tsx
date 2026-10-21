import { Search, X } from 'lucide-react'
import type { UserProfile } from '../../../entities/profile/model/types'
import { SearchSelect } from '../../../shared/ui/select/SearchSelect'
import type { GraphSearchCriteria, GraphSearchScope } from '../model/types'

type Props = {
  scope: GraphSearchScope
  criteria: GraphSearchCriteria
  users: UserProfile[]
  onChange: (criteria: GraphSearchCriteria) => void
  onSubmit: () => void
  onReset: () => void
}

const labels: Record<GraphSearchScope, string> = { expressions: '表达', agreements: '约定', actions: '行动', users: '用户' }
const placeholders: Record<GraphSearchScope, string> = {
  expressions: '搜索表达正文或节点标题', agreements: '搜索约定正文或回应行动标题',
  actions: '搜索行动正文或标题', users: '搜索本图参与用户的昵称',
}

/** Renders category-specific criteria without sharing drafts or submitting on filter changes. */
export function GraphSearchForm({ scope, criteria, users, onChange, onSubmit, onReset }: Props) {
  const options = [{ value: '', label: '全部' }, ...users.map((user) => ({ value: user.id, label: user.name }))]
  const filters = scope === 'agreements'
    ? [{ field: 'participantId' as const, label: '参与者一' }, { field: 'otherParticipantId' as const, label: '参与者二' }]
    : scope === 'users' ? [] : [{ field: 'authorId' as const, label: '作者' }]
  const hasCriteria = Boolean(criteria.keyword.trim() || filters.some(({ field }) => criteria[field]))
  return <form className="space-y-3" role="search" aria-label={`${labels[scope]}搜索`} onSubmit={(event) => { event.preventDefault(); if (hasCriteria) onSubmit() }}>
    <div className="flex gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-signal">
        <Search className="shrink-0 text-muted" size={16} aria-hidden="true" />
        <input className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none" type="search" aria-label={`搜索${labels[scope]}`} placeholder={placeholders[scope]} value={criteria.keyword} onChange={(event) => onChange({ ...criteria, keyword: event.target.value })} />
        {criteria.keyword && <button className="inline-grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-soft hover:text-ink" type="button" onClick={() => onChange({ ...criteria, keyword: '' })} aria-label="清空关键词"><X size={14} /></button>}
      </label>
      <button className="primary-button" type="submit" disabled={!hasCriteria}>搜索</button>
      <button className="quiet-button" type="button" onClick={onReset}>重置</button>
    </div>
    {filters.length > 0 && <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {filters.map(({ field, label }) => <div key={field} className="flex items-center gap-2"><span className="text-xs text-muted">{label}</span>
        <SearchSelect ariaLabel={label} value={criteria[field] ?? ''}
          options={options.filter((option) => !option.value || field === 'authorId' || option.value !== criteria[field === 'participantId' ? 'otherParticipantId' : 'participantId'])}
          onValueChange={(value) => onChange({ ...criteria, [field]: value || undefined })} />
      </div>)}
    </div>}
  </form>
}
