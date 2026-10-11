import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { ToastContext, type ToastInput, type ToastItem } from './ToastContext'

/** Provides one shared Radix toast viewport for lightweight application feedback. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const showToast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { ...input, id }])
  }, [])
  const dismissToast = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  return <ToastContext.Provider value={{ showToast }}>
    <ToastPrimitive.Provider swipeDirection="up">
      {children}
      <ToastPrimitive.Viewport className="fixed left-1/2 top-5 z-[100] grid w-max max-w-[calc(100vw-32px)] -translate-x-1/2 gap-2 p-0 outline-none" aria-label="提示">
        {toasts.map((toast) => <ToastPrimitive.Root className={`flex min-h-[42px] w-max max-w-full items-center gap-[9px] rounded-lg border bg-surface px-3.5 py-2 text-xs text-ink shadow-app animate-[toast-in_160ms_ease-out] ${toast.kind === 'error' ? 'border-coral text-coral' : toast.kind === 'warning' ? 'border-warning text-warning' : 'border-signal text-signal'}`} key={toast.id} duration={toast.duration ?? 2800} onOpenChange={(open) => { if (!open) dismissToast(toast.id) }}>
          <span className="inline-flex flex-none" aria-hidden="true">{toast.kind === 'error' ? <CircleAlert size={17} /> : toast.kind === 'warning' ? <TriangleAlert size={17} /> : <Info size={17} />}</span>
          <ToastPrimitive.Description className="break-words">{toast.message}</ToastPrimitive.Description>
        </ToastPrimitive.Root>)}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Provider>
  </ToastContext.Provider>
}
