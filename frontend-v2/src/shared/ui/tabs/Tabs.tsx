import type { ReactNode } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

type TabsRootProps = {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}

/** Controlled Tabs root used for grouped settings and other compact navigation. */
export function TabsRoot({ value, onValueChange, children }: TabsRootProps) {
  return <TabsPrimitive.Root value={value} onValueChange={onValueChange}>{children}</TabsPrimitive.Root>
}

/** Accessible tab list with the settings page's visual treatment. */
export function TabsList({ label, children, sticky = false, showDivider = true }: { label: string; children: ReactNode; sticky?: boolean; showDivider?: boolean }) {
  return <TabsPrimitive.List className={`mt-[23px] flex gap-[26px] overflow-x-auto ${showDivider ? 'border-b border-line' : ''} ${sticky ? 'sticky top-0 z-20 bg-paper' : ''}`} aria-label={label}>{children}</TabsPrimitive.List>
}

/** Single tab trigger. */
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Trigger className="min-h-11 whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-0.5 text-sm font-medium text-muted transition hover:text-signal data-[state=active]:border-signal data-[state=active]:font-semibold data-[state=active]:text-signal" value={value}>{children}</TabsPrimitive.Trigger>
}

/** Content panel associated with a tab trigger. */
export function TabsContent({ value, children, keepMounted = false }: { value: string; children: ReactNode; keepMounted?: boolean }) {
  return <TabsPrimitive.Content className="outline-none data-[state=inactive]:hidden" value={value} forceMount={keepMounted ? true : undefined}>{children}</TabsPrimitive.Content>
}
