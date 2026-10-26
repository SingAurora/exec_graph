import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Action } from '../../entities/action/model/legacy-types'

type CompletionModalProps = { action: Action | null; onClose: () => void; onSave: (note: string) => void }

export function CompletionModal({ action, onClose, onSave }: CompletionModalProps) {
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (action) { setNote(''); inputRef.current?.focus() }
  }, [action])

  if (!action) return null
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className="relative w-[min(100%,480px)] rounded-lg bg-surface p-7 shadow-app">
        <button className="absolute right-3 top-3 grid size-8 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-soft hover:text-ink" type="button" onClick={onClose} title="关闭"><X size={20} /></button>
        <div className="section-kicker">完成记录</div><h2 id="completion-title" className="mt-[7px] text-[22px]">这次做得怎么样？</h2><p className="mt-2 text-[13px] leading-[1.7] text-muted">写一句实际发生的事，留给未来的自己。</p>
        <label className="sr-only" htmlFor="completionInput">完成记录</label><textarea className="mt-5 min-h-24 w-full resize-y rounded-md border border-line bg-paper p-2.5 text-[13px] leading-[1.6] text-ink outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" id="completionInput" ref={inputRef} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：重点部位都洗到了，洗完擦干了，用品也放回去了。" />
        <div className="mt-[15px] flex justify-end gap-[9px]"><button className="text-button" type="button" onClick={onClose}>先不记录</button><button className="primary-button" type="button" disabled={!note.trim()} onClick={() => onSave(note.trim())}>保存记录</button></div>
      </section>
    </div>
  )
}
