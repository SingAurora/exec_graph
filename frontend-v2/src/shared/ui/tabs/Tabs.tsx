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
export function TabsList({ label, children }: { label: string; children: ReactNode }) {
  return <TabsPrimitive.List className="mt-[23px] flex gap-[26px] overflow-x-auto border-b border-line" aria-label={label}>{children}</TabsPrimitive.List>
}

/** Single tab trigger. */
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Trigger className="min-h-[43px] whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-0.5 text-[13px] font-bold text-muted transition hover:border-signal hover:text-ink data-[state=active]:border-signal data-[state=active]:text-ink" value={value}>{children}</TabsPrimitive.Trigger>
}

/** Content panel associated with a tab trigger. */
export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Content className="outline-none" value={value}>{children}</TabsPrimitive.Content>
}
