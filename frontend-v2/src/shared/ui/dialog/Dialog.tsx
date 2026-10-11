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

/** Accessible modal foundation shared by business features. */
export function Dialog({ open, title, description, eyebrow, className = '', returnFocusRef, children, onOpenChange }: DialogProps) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-backdrop" />
      <DialogPrimitive.Content className={`dialog-content ${className}`.trim()} onCloseAutoFocus={(event) => { if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus() } }}>
        <DialogPrimitive.Close asChild><button className="dialog-close" type="button" aria-label="关闭" title="关闭"><X size={18} /></button></DialogPrimitive.Close>
        {eyebrow && <span className="section-kicker">{eyebrow}</span>}
        <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
}
