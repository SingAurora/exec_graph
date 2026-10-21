import { Search, X } from 'lucide-react'

const inputSizes = { standard: 'h-9 w-[216px] shrink-0 px-2.5', sidebar: 'h-8 w-full px-2', wide: 'h-10 w-full px-3' } as const
type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  size?: keyof typeof inputSizes
  clearLabel?: string
  onClear?: () => void
}

/** Compact keyword input with a consistent accessible label and clear action. */
export function SearchInput({ label, value, onChange, size = 'standard', clearLabel = '清除搜索', onClear }: Props) {
  return <div role="search" className={`flex items-center gap-2 rounded-md border border-line bg-surface focus-within:border-signal ${inputSizes[size]}`}>
    <Search size={15} className="shrink-0 text-muted" aria-hidden="true" />
    <input aria-label={`搜索${label}`} placeholder={`搜索${label}`} type="search" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13px] leading-5 outline-none [&::-webkit-search-cancel-button]:hidden" />
    {value && <button type="button" aria-label={clearLabel} onClick={() => onClear ? onClear() : onChange('')} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"><X size={14} /></button>}
  </div>
}
