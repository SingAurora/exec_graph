import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CreateGraphInput } from '../model/types'
import { CreateGraphDialog } from './CreateGraphDialog'

/** Opens the shared form that creates an empty public graph. */
export function CreateGraphButton({ onCreate, compact = false }: { onCreate: (input: CreateGraphInput) => void | Promise<void>; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button className={compact ? 'text-button text-xs' : 'primary-button'} type="button" title="发起行动图" ref={trigger} onClick={() => setOpen(true)}><Plus size={compact ? 14 : 16} />{compact ? '发起' : '发起行动图'}</button>
      {open && <CreateGraphDialog returnFocusRef={trigger} onClose={() => setOpen(false)} onCreate={async (input) => { await onCreate(input); setOpen(false) }} />}
    </>
  )
}
