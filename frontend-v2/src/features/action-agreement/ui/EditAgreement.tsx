import { useId, useState } from 'react'
import { useToast } from '../../../shared/ui/toast/useToast'

/** Edits the current effective agreement without rewriting the inherited source. */
export function EditAgreement({ markdown, onSave, onSaved, onCancel }: {
  markdown: string
  onSave: (markdown: string) => boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(markdown)
  const [clearing, setClearing] = useState(false)
  const inputId = useId()
  const { showToast } = useToast()
  const hasContent = Boolean(markdown.trim())
  const label = hasContent ? '修改约定' : '补充约定'
  const canSave = draft.trim() !== markdown.trim() && (Boolean(draft.trim()) || clearing)
  const save = (value: string) => {
    if (!onSave(value)) {
      showToast({ kind: 'error', message: '节点状态已变化，无法保存约定' })
      return
    }
    showToast({ kind: 'info', message: value.trim() ? `已${label}` : '已清空约定' })
    onSaved()
  }

  return <form className="border-t border-line p-3" aria-label={`${label}表单`} onSubmit={(event) => {
    event.preventDefault()
    if (canSave) save(draft)
  }}>
    <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
    <textarea id={inputId} autoFocus className="mt-3 min-h-32 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm leading-[1.85] outline-none focus:border-signal" placeholder={clearing ? '保存后将清空约定' : '后续引用这个节点时，需要遵守什么'} value={draft} onChange={(event) => { setDraft(event.target.value); setClearing(false) }} />
    <div className="mt-3 flex justify-end gap-2">
      {hasContent && <button className="text-button mr-auto text-coral" type="button" onClick={() => { setDraft(''); setClearing(true) }}>清空约定</button>}
      <button className="text-button" type="button" onClick={onCancel}>取消</button>
      <button className="primary-button" type="submit" disabled={!canSave}>保存约定</button>
    </div>
  </form>
}
