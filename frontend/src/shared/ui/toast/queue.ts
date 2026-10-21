import type { ToastItem } from './ToastContext'

export type ToastEntry = ToastItem & { open: boolean }

const maxVisibleToasts = 3

/** Keeps the latest feedback at the bottom, replacing duplicates with fresh content and timers. */
export function enqueueToast(current: ToastEntry[], incoming: ToastEntry): ToastEntry[] {
  const remaining = current.filter((toast) => toast.open && !(toast.message === incoming.message
    && (toast.kind ?? 'info') === (incoming.kind ?? 'info')
    && toast.action?.label === incoming.action?.label))
  return [...remaining, incoming].slice(-maxVisibleToasts)
}
