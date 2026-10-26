import { ArrowLeft } from 'lucide-react'
import { Tooltip } from '../tooltip/Tooltip'

type BackButtonProps = {
  label: string
  onBack: () => void
}

/** Compact page return control with a fixed hit area and an accessible destination label. */
export function BackButton({ label, onBack }: BackButtonProps) {
  return (
    <Tooltip content={label} side="bottom">
      <button className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted transition-colors hover:bg-soft hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" type="button" aria-label={label} onClick={onBack}>
        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
