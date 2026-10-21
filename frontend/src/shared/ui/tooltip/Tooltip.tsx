import type { ReactElement, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

/** Provides consistent timing for all application tooltips. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={250}>{children}</TooltipPrimitive.Provider>
}

/** Describes an icon or compact control on hover and keyboard focus. */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactElement; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content className="z-[90] max-w-[min(280px,calc(100vw-24px))] break-words rounded-lg border border-line bg-surface px-3 py-2 text-xs font-normal leading-relaxed text-copy shadow-app" side={side} sideOffset={6} collisionPadding={12}>
        {content}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
}
