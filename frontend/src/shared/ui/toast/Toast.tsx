import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { ToastContext, type ToastInput } from './ToastContext'
import { enqueueToast, type ToastEntry } from './queue'

const defaultToastDurationMs = 2000

/** Provides one shared Radix toast viewport for lightweight application feedback. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const showToast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => enqueueToast(current, { ...input, id, open: true }))
  }, [])
  const closeToast = useCallback((id: string) => setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, open: false } : toast)), [])
  const dismissToast = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-max max-w-[min(384px,calc(100vw-48px))] flex-col items-end gap-2 p-0 outline-none">
          {toasts.map((toast) => <ToastNotification key={toast.id} toast={toast} onClose={closeToast} onDismiss={dismissToast} />)}
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

function ToastNotification({ toast, onClose, onDismiss }: {
  toast: ToastEntry
  onClose: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const { id, open, duration = defaultToastDurationMs } = toast
  // Own the lifetime so Radix hover, focus, and window-blur pauses cannot extend it.
  useEffect(() => {
    if (!open || duration === Infinity) return
    const timer = window.setTimeout(() => onClose(id), duration)
    return () => window.clearTimeout(timer)
  }, [id, open, duration, onClose])

  return (
    <ToastPrimitive.Root className={`pointer-events-auto flex min-h-[42px] w-max max-w-full items-center gap-[9px] rounded-lg border bg-surface px-3.5 py-2 text-xs text-ink shadow-app data-[state=open]:animate-[toast-in_160ms_ease-out] data-[state=closed]:animate-[toast-out_180ms_ease-in_forwards] data-[state=closed]:pointer-events-none ${toast.kind === 'error' ? 'border-coral text-coral' : toast.kind === 'warning' ? 'border-warning text-warning' : 'border-signal text-signal'}`} open={open} duration={Infinity} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(id) }} onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && event.animationName === 'toast-out') onDismiss(id)
    }}>
      <span className="inline-flex flex-none">{toast.kind === 'error' ? <CircleAlert size={17} /> : toast.kind === 'warning' ? <TriangleAlert size={17} /> : <Info size={17} />}</span>
      <ToastPrimitive.Description className="min-w-0 break-words">{toast.message}</ToastPrimitive.Description>
      {toast.action && <ToastPrimitive.Action className="ml-2 shrink-0 rounded border-0 bg-transparent px-1 py-1 font-semibold text-signal hover:bg-soft" altText={toast.action.label} onClick={toast.action.onClick}>{toast.action.label}</ToastPrimitive.Action>}
    </ToastPrimitive.Root>
  )
}
