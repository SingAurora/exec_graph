import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Action } from '../../shared/model'

type CompletionModalProps = { action: Action | null; onClose: () => void; onSave: (note: string) => void }

export function CompletionModal({ action, onClose, onSave }: CompletionModalProps) {
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (action) { setNote(''); inputRef.current?.focus() }
  }, [action])

  if (!action) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="completion-modal" role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
      <div className="section-kicker">完成记录</div><h2 id="completion-title">这次做得怎么样？</h2><p>写一句实际发生的事，留给未来的自己。</p>
      <label className="sr-only" htmlFor="completionInput">完成记录</label><textarea id="completionInput" ref={inputRef} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：重点部位都洗到了，洗完擦干了，用品也放回去了。" />
      <div className="modal-actions"><button className="text-button" type="button" onClick={onClose}>先不记录</button><button className="primary-button" type="button" disabled={!note.trim()} onClick={() => onSave(note.trim())}>保存记录</button></div>
    </section>
  </div>
}
