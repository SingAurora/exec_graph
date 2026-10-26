import type { ReactNode } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

type TabsRootProps = {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

/** Controlled Tabs root used for grouped settings and other compact navigation. */
export function TabsRoot({ value, onValueChange, children, className }: TabsRootProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>{children}</TabsPrimitive.Root>
  )
}

/** Accessible tab list with the settings page's visual treatment. */
export function TabsList({ label, children, sticky = false, showDivider = true, compact = false }: { label: string; children: ReactNode; sticky?: boolean; showDivider?: boolean; compact?: boolean }) {
  return (
    <TabsPrimitive.List className={`flex overflow-x-auto ${compact ? 'gap-5' : 'mt-[23px] gap-[26px]'} ${showDivider ? 'border-b border-line' : ''} ${sticky ? 'sticky top-0 z-20 bg-paper' : ''}`} aria-label={label}>{children}</TabsPrimitive.List>
  )
}

/** Single tab trigger. */
export function TabsTrigger({ value, children, disabled = false, compact = false, className = '' }: { value: string; children: ReactNode; disabled?: boolean; compact?: boolean; className?: string }) {
  return (
    <TabsPrimitive.Trigger className={`${compact ? 'min-h-9 text-[13px]' : 'min-h-11 text-sm'} whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-0.5 font-medium text-muted transition hover:text-signal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted data-[state=active]:border-signal data-[state=active]:font-semibold data-[state=active]:text-signal ${className}`} value={value} disabled={disabled}>{children}</TabsPrimitive.Trigger>
  )
}

/** Content panel associated with a tab trigger. */
export function TabsContent({ value, children, keepMounted = false, className = '' }: { value: string; children: ReactNode; keepMounted?: boolean; className?: string }) {
  return (
    <TabsPrimitive.Content className={`outline-none data-[state=inactive]:hidden ${className}`} value={value} forceMount={keepMounted ? true : undefined}>{children}</TabsPrimitive.Content>
  )
}
