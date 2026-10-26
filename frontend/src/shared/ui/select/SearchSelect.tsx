import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useId, useState } from 'react'

type Option = { value: string; label: string }
type Props = {
  value: string
  options: Option[]
  ariaLabel: string
  onValueChange: (value: string) => void
}

/** Searchable single selection with keyboard navigation and the shared popover styling. */
export function SearchSelect({ value, options, ariaLabel, onValueChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()
  const matches = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = options.find((option) => option.value === value)
  const choose = (option: Option) => { onValueChange(option.value); setOpen(false) }
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); setQuery(''); setActiveIndex(0) }}>
      <Popover.Trigger className="inline-flex h-9 min-w-28 max-w-48 items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 text-[13px] text-ink outline-none hover:border-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" aria-label={ariaLabel}>
        <span className="truncate">{selected?.label ?? '全部'}</span><ChevronDown size={14} className="shrink-0 text-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-40 w-60 rounded-md border border-line bg-surface p-1 shadow-app" sideOffset={5} align="start">
          <div className="m-1 flex items-center gap-2 rounded border border-line px-2">
            <Search size={14} className="shrink-0 text-muted" />
            <input className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" role="combobox" aria-label={`搜索${ariaLabel}`} aria-expanded={open} aria-autocomplete="list" aria-controls={listId}
              aria-activedescendant={matches[activeIndex] ? `${listId}-${activeIndex}` : undefined} placeholder="搜索昵称" value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const index = Math.max(0, Math.min(matches.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)))
                  setActiveIndex(index)
                  document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' })
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  if (matches[activeIndex]) choose(matches[activeIndex])
                }
              }} />
          </div>
          <div id={listId} role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto">
            {matches.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option" aria-selected={option.value === value} tabIndex={-1}
              className={`flex min-h-9 w-full items-center justify-between gap-3 rounded border-0 px-2.5 text-left text-[13px] ${activeIndex === index ? 'bg-soft text-signal' : 'bg-transparent text-ink'}`}
              onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
              <span className="truncate">{option.label}</span>{option.value === value && <Check size={14} className="shrink-0 text-signal" />}
            </button>)}
            {!matches.length && <p className="px-3 py-4 text-center text-xs text-muted">没有匹配的用户</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
