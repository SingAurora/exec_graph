import { Check, X } from 'lucide-react'
import { toast } from 'sonner'

export function showSuccessToast(message: string) {
  toast.success(message, {
    icon: <Check size={14} className="text-moss" aria-hidden="true" />,
  })
}

export function showErrorToast(message: string) {
  toast.error(message, {
    icon: <X size={14} className="text-clay" aria-hidden="true" />,
  })
}
