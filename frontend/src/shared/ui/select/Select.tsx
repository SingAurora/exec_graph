import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Select as SelectPrimitive } from 'radix-ui'

export type SelectOption = {
  value: string
  label: ReactNode
}

type SelectProps = {
  value: string
  options: SelectOption[]
  label: string
  className?: string
  disabled?: boolean
  onValueChange: (value: string) => void
}

/** Single-value select with the application's visual language. */
export function Select({ value, options, label, className, disabled = false, onValueChange }: SelectProps) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger className={`inline-flex h-9 min-w-[126px] items-center justify-between gap-4 rounded-md border-0 bg-transparent px-2.5 py-0 text-xs font-semibold text-ink outline-none focus-visible:rounded focus-visible:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)] disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`.trim()} title={label}>
        <SelectPrimitive.Value>{selectedOption?.label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild><ChevronDown size={14} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-40 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-surface p-1 shadow-app" position="popper" sideOffset={5}>
          <SelectPrimitive.Viewport>
            {options.map((option) => <SelectPrimitive.Item className="relative flex min-h-8 items-center rounded px-[9px] pr-[30px] text-xs text-ink outline-none select-none data-[highlighted]:bg-soft data-[highlighted]:text-signal" value={option.value} key={option.value}>
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center text-signal"><Check size={14} /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
