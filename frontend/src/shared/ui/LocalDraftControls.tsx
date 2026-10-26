import { useState } from 'react'
import type { LocalDraftStatus } from '../lib/local-draft/useLocalDraft'
import { Dialog } from './dialog/Dialog'

/** Quiet local-save feedback with an explicit way to abandon unpublished edits. */
export function LocalDraftControls({ status, hasDraft, disabled, onDiscard }: {
  status: LocalDraftStatus; hasDraft: boolean; disabled?: boolean; onDiscard: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span role="status" className={status === 'error' ? 'text-coral' : ''}>{status === 'loading' ? '正在读取本地草稿…' : status === 'saving' ? '正在保存…' : status === 'saved' ? '已保存到本机' : status === 'error' ? '本地保存失败，请勿关闭页面' : ''}</span>
      {hasDraft && <button className="text-button text-xs" type="button" disabled={disabled} onClick={() => setConfirming(true)}>放弃草稿</button>}
      <Dialog open={confirming} onOpenChange={setConfirming} title="放弃本地草稿？" description="仅清除本次未发布的编辑，不会更改已经发布的节点。">
        <p className="mt-3 text-sm leading-7 text-muted">本次草稿中的对话和修改将被清除，已发布内容不受影响。</p>
        <div className="mt-5 flex justify-end gap-3"><button className="quiet-button" type="button" onClick={() => setConfirming(false)}>继续编辑</button><button className="primary-button" type="button" onClick={() => { onDiscard(); setConfirming(false) }}>放弃草稿</button></div>
      </Dialog>
    </div>
  )
}
