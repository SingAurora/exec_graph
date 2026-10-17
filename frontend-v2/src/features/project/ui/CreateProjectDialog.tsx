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

  return <Dialog open title="发起行动图" description="填写行动图名称和起始行动。" eyebrow="新行动图" className="w-[min(calc(100%-40px),480px)] rounded-lg p-[26px] max-[700px]:px-5 max-[700px]:pb-5 max-[700px]:pt-[23px]" returnFocusRef={returnFocusRef} onOpenChange={(open) => { if (!open) onClose() }}>
    <form className="mt-[23px] grid gap-2" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <label className="mt-[7px] flex items-center justify-between text-xs font-bold text-ink" htmlFor="project-title">起始行动标题</label><input className="w-full rounded-md border border-line bg-paper px-[11px] py-2.5 text-[13px] text-ink outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" id="project-title" value={title} maxLength={50} autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="例如：日常空间整理" />
      <label className="mt-[7px] flex items-center justify-between text-xs font-bold text-ink" htmlFor="project-description">起始行动记录<span className="text-[10px] font-medium text-muted">可选</span></label><textarea className="min-h-24 w-full resize-y rounded-md border border-line bg-paper px-[11px] py-2.5 text-[13px] leading-[1.6] text-ink outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" id="project-description" value={description} maxLength={200} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="描述这次行动实际开始了什么。" />
      <p className="mt-1 text-[11px] leading-[1.6] text-muted">提交后会同时创建行动图和节点 #1，这两项内容会作为节点 #1 的默认内容。</p>
      <div className="mt-[15px] flex justify-end gap-[9px]"><button className="quiet-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!title.trim()}>发起行动图</button></div>
    </form>
  </Dialog>
}
