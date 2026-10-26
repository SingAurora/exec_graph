import type { ProfileSearchCriteria, ProfileSearchScope } from '../model/types'
import { SearchInput } from '../../../shared/ui/SearchInput'
import { SearchSelect } from '../../../shared/ui/select/SearchSelect'

type Props = {
  scope: ProfileSearchScope
  criteria: ProfileSearchCriteria
  counterpartOptions: { value: string; label: string }[]
  onChange: (criteria: ProfileSearchCriteria) => void
  onSubmit: () => void
  onReset: () => void
}
const labels: Record<ProfileSearchScope, string> = { expressions: '表达', agreements: '约定', actions: '行动', graphs: '图' }

/** Profile-specific search controls, with a counterpart filter for agreement exchanges. */
export function ProfileSearchForm({ scope, criteria, counterpartOptions, onChange, onSubmit, onReset }: Props) {
  const hasCriteria = Boolean(criteria.keyword.trim() || (scope === 'agreements' && criteria.counterpartId))
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (hasCriteria) onSubmit() }}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><SearchInput label={labels[scope]} value={criteria.keyword} size="wide" onChange={(keyword) => onChange({ ...criteria, keyword })} /></div>
        <button className="primary-button" type="submit" disabled={!hasCriteria}>搜索</button>
        <button className="quiet-button" type="button" onClick={onReset}>重置</button>
      </div>
      {scope === 'agreements' && <div className="flex items-center gap-2">
        <span className="text-xs text-muted">往来对象</span>
        <SearchSelect label="往来对象" value={criteria.counterpartId} options={[{ value: '', label: '全部对象' }, ...counterpartOptions]} onValueChange={(counterpartId) => onChange({ ...criteria, counterpartId })} />
      </div>}
    </form>
  )
}
