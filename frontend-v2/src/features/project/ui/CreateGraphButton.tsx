import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CreateProjectInput } from '../model/types'
import { CreateProjectDialog } from './CreateProjectDialog'

/** Opens the shared form that creates an empty public graph. */
export function CreateGraphButton({ onCreate }: { onCreate: (input: CreateProjectInput) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return <>
    <button className="primary-button" type="button" ref={trigger} onClick={() => setOpen(true)}><Plus size={16} />发起行动图</button>
    {open && <CreateProjectDialog returnFocusRef={trigger} onClose={() => setOpen(false)} onCreate={(input) => { setOpen(false); onCreate(input) }} />}
  </>
}
