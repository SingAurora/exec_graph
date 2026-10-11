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
  ariaLabel: string
  onValueChange: (value: string) => void
}

/** Accessible single-value select with the application's visual language. */
export function Select({ value, options, ariaLabel, onValueChange }: SelectProps) {
  const selectedOption = options.find((option) => option.value === value)

  return <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
    <SelectPrimitive.Trigger className="select-trigger" aria-label={ariaLabel}>
      <SelectPrimitive.Value>{selectedOption?.label}</SelectPrimitive.Value>
      <SelectPrimitive.Icon asChild><ChevronDown size={14} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="select-content" position="popper" sideOffset={5}>
        <SelectPrimitive.Viewport>
          {options.map((option) => <SelectPrimitive.Item className="select-item" value={option.value} key={option.value}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="select-item-indicator"><Check size={14} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
}
