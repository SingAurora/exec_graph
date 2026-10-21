import { createContext, type ReactNode } from 'react'

export type ToastKind = 'error' | 'warning' | 'info'

export type ToastInput = {
  message: ReactNode
  kind?: ToastKind
  duration?: number
  action?: { label: string; onClick: () => void }
}

export type ToastItem = ToastInput & { id: string }
export type ToastContextValue = { showToast: (input: ToastInput) => void }

export const ToastContext = createContext<ToastContextValue | null>(null)
