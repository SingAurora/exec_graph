import { useState, type RefObject } from 'react'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import type { CreateProjectInput } from '../model/types'

type CreateProjectDialogProps = {
  onClose: () => void
  onCreate: (input: CreateProjectInput) => void | Promise<void>
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function CreateProjectDialog({ onClose, onCreate, returnFocusRef }: CreateProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const projectTitle = title.trim()
    if (!projectTitle || saving) return
    setSaving(true); setError('')
    try { await onCreate({ title: projectTitle, description: description.trim() }) }
    catch (failure) { setError(failure instanceof Error ? failure.message : '创建失败，请重试') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open title="发起行动图" description="创建一个公开的行动图，之后记录第一次行动。" className="w-[min(calc(100%-40px),480px)] rounded-lg p-[26px]" returnFocusRef={returnFocusRef} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <form className="mt-[23px] grid gap-2" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <fieldset className="contents" disabled={saving}>
        <label className="mt-2 text-sm font-medium" htmlFor="project-title">图名称</label><input className="form-input" id="project-title" required value={title} maxLength={50} autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="例如：日常空间整理" />
        <label className="mt-3 flex items-center justify-between text-sm font-medium" htmlFor="project-description">图简介<span className="text-xs font-normal text-muted">可选</span></label><textarea className="form-input min-h-28 resize-y leading-6" id="project-description" value={description} maxLength={200} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="介绍这张图" />
        <div className="mt-[15px] flex justify-end gap-[9px]"><button className="quiet-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!title.trim()}>发起行动图</button></div>
        </fieldset>
        {error && <p role="alert" className="text-xs text-coral">{error}</p>}
      </form>
    </Dialog>
  )
}
