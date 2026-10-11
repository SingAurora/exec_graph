import { useState, type RefObject } from 'react'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import type { CreateProjectInput } from '../model/types'

type CreateProjectDialogProps = {
  onClose: () => void
  onCreate: (input: CreateProjectInput) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function CreateProjectDialog({ onClose, onCreate, returnFocusRef }: CreateProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const submit = () => {
    const projectTitle = title.trim()
    if (!projectTitle) return
    onCreate({ title: projectTitle, description: description.trim() })
  }

  return <Dialog open title="创建项目" description="填写项目名称和可选的项目说明。" eyebrow="新项目" className="create-project-dialog" returnFocusRef={returnFocusRef} onOpenChange={(open) => { if (!open) onClose() }}>
    <form onSubmit={(event) => { event.preventDefault(); submit() }}>
      <label htmlFor="project-title">项目名称</label><input id="project-title" value={title} maxLength={50} autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="例如：日常空间整理" />
      <label htmlFor="project-description">项目说明<span>可选</span></label><textarea id="project-description" value={description} maxLength={200} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="这个项目准备持续推进什么？" />
      <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!title.trim()}>创建项目</button></div>
    </form>
  </Dialog>
}
