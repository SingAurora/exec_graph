import { X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

type DialogProps = {
  open: boolean
  title: string
  description: string
  eyebrow?: string
  className?: string
  returnFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
  onOpenChange: (open: boolean) => void
}

/** Modal foundation shared by business features. */
export function Dialog({ open, title, description, eyebrow, className = '', returnFocusRef, children, onOpenChange }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] data-[state=closed]:animate-[overlay-out_140ms_ease-in] data-[state=open]:animate-[overlay-in_140ms_ease-out]" />
        <DialogPrimitive.Content className={`fixed left-1/2 top-1/2 z-50 w-[min(100%-32px,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-7 text-ink shadow-app outline-none data-[state=closed]:animate-[dialog-out_140ms_ease-in] data-[state=open]:animate-[dialog-in_140ms_ease-out] ${className}`.trim()} onCloseAutoFocus={(event) => { if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus() } }}>
          <DialogPrimitive.Close asChild><button className="absolute right-3 top-3 grid size-8 place-items-center rounded-md border-0 bg-transparent text-muted transition hover:bg-soft hover:text-ink" type="button" title="关闭"><X size={18} /></button></DialogPrimitive.Close>
          {eyebrow && <span className="section-kicker">{eyebrow}</span>}
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
