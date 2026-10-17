import { CircleHelp, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Popover } from 'radix-ui'

type HelpPopoverProps = {
  title: string
  children: ReactNode
}

/** Click-to-open contextual help with keyboard dismissal and focus restoration. */
export function HelpPopover({ title, children }: HelpPopoverProps) {
  const titleId = useId()
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button className="inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 text-muted hover:bg-soft hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={`${title}帮助`}>
        <CircleHelp size={14} aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="z-[90] max-h-[calc(100dvh-32px)] w-[300px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-line bg-surface p-4 text-ink shadow-app outline-none" sideOffset={8} collisionPadding={12} aria-labelledby={titleId}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 id={titleId} className="text-xs font-semibold">{title}</h4>
          <Popover.Close asChild>
            <button className="inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-signal" type="button" aria-label="关闭帮助"><X size={14} aria-hidden="true" /></button>
          </Popover.Close>
        </div>
        <div className="space-y-3 text-[11px] leading-[1.9] text-muted">{children}</div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
