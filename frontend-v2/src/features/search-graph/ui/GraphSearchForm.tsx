import { Search, X } from 'lucide-react'

export type GraphSearchScope = 'expressions' | 'actions' | 'users'

type GraphSearchFormProps = {
  scope: GraphSearchScope
  value: string
  onValueChange: (value: string) => void
  onScopeChange: (scope: GraphSearchScope) => void
  onSubmit: () => void
  onClear: () => void
}

const scopes: { value: GraphSearchScope; label: string }[] = [
  { value: 'expressions', label: '表达' },
  { value: 'actions', label: '行动' },
  { value: 'users', label: '参与用户' },
]

/** Submits graph-local keywords and switches between the three supported search scopes. */
export function GraphSearchForm({ scope, value, onValueChange, onScopeChange, onSubmit, onClear }: GraphSearchFormProps) {
  const label = scopes.find((item) => item.value === scope)!.label
  return <div>
    <form className="flex gap-2" role="search" aria-label="图内搜索" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-signal">
        <Search className="shrink-0 text-muted" size={16} aria-hidden="true" />
        <input className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none" type="search" aria-label={`搜索${label}`} placeholder={`搜索${label}`} value={value} onChange={(event) => onValueChange(event.target.value)} />
        {value && <button className="inline-grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-soft hover:text-ink" type="button" onClick={onClear} aria-label="清空搜索"><X size={14} /></button>}
      </label>
      <button className="primary-button" type="submit" disabled={!value.trim()}>搜索</button>
    </form>
    <div className="mt-3 flex gap-5" role="radiogroup" aria-label="搜索类型">
      {scopes.map((item) => <label key={item.value} className={`relative cursor-pointer py-1 text-[13px] ${scope === item.value ? 'font-medium text-signal' : 'text-muted hover:text-ink'}`}>
        <input className="peer sr-only" type="radio" name="graph-search-scope" value={item.value} checked={scope === item.value} onChange={() => onScopeChange(item.value)} />
        <span className="rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal">{item.label}</span>
      </label>)}
    </div>
  </div>
}
