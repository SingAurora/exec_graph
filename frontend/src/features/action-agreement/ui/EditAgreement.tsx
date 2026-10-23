import { useId, useState } from 'react'
import { useToast } from '../../../shared/ui/toast/useToast'
import { useLocalDraft } from '../../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../../shared/ui/LocalDraftControls'
import { isAgreementDraft, type AgreementDraft } from '../model/draft'

/** 修改当前有效约定，只在本节点形成新版本，不回写被继承的来源节点。 */
export function EditAgreement({ markdown, draftKey, onSave, onSaved, onCancel }: {
  markdown: string
  draftKey?: string
  onSave: (markdown: string) => boolean | Promise<boolean>
  onSaved: () => void
  onCancel: () => void
}) {
  const local = useLocalDraft<AgreementDraft>({ draftKey, initialValue: { markdown, clearing: false, baseMarkdown: markdown },
    validate: isAgreementDraft, hasContent: (value) => value.markdown !== markdown || value.clearing })
  const { markdown: draft, clearing } = local.value
  const inputId = useId()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const hasContent = Boolean(markdown.trim())
  const label = hasContent ? '修改约定' : '补充约定'
  const stale = local.value.baseMarkdown !== markdown
  const canSave = local.ready && !saving && !stale && draft.trim() !== markdown.trim() && (Boolean(draft.trim()) || clearing)
  const save = async (value: string) => {
    if (saving) return
    setSaving(true)
    try {
      if (!await onSave(value)) { showToast({ kind: 'error', message: '节点状态已变化，无法保存约定' }); return }
      local.remove()
      showToast({ kind: 'info', message: value.trim() ? `已${label}` : '已清空约定' })
      onSaved()
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '保存失败，请重试' }) }
    finally { setSaving(false) }
  }

  return <form className="border-t border-line p-3" aria-label={`${label}表单`} onSubmit={(event) => {
    event.preventDefault()
    if (canSave) save(draft)
  }}>
    <fieldset className="contents" disabled={saving}>
    <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
    {stale && <p className="mt-2 text-xs text-coral">约定已更新，请核对后继续编辑。</p>}
    <textarea id={inputId} autoFocus disabled={!local.ready} className="mt-3 min-h-32 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm leading-[1.85] outline-none focus:border-signal" placeholder={clearing ? '保存后将清空约定' : '后续引用这个节点时，需要遵守什么'} value={draft} onChange={(event) => local.update({ markdown: event.target.value, clearing: false, baseMarkdown: markdown })} />
    <LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={!local.ready} onDiscard={local.discard} />
    <div className="mt-3 flex justify-end gap-2">
      {hasContent && <button className="text-button mr-auto text-coral" type="button" disabled={!local.ready} onClick={() => local.update({ markdown: '', clearing: true, baseMarkdown: markdown })}>清空约定</button>}
      <button className="text-button" type="button" onClick={onCancel}>取消</button>
      <button className="primary-button" type="submit" disabled={!canSave}>保存约定</button>
    </div>
    </fieldset>
  </form>
}
