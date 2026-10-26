import { Trash2 } from 'lucide-react'
import { AlertDialog } from 'radix-ui'
import { useState } from 'react'
import { useToast } from '../../../shared/ui/toast/useToast'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'

type DeleteProjectProps = {
  title: string
  nodeCount: number
  disabledReason?: string
  onDelete: (expectedNodeCount: number) => boolean | Promise<boolean>
}

/** Deletes empty graphs directly and requires an explicit node-count confirmation for populated graphs. */
export function DeleteProject({ title, nodeCount, onDelete, disabledReason }: DeleteProjectProps) {
  const [confirmationCount, setConfirmationCount] = useState<number>()
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const remove = async (expectedNodeCount: number) => {
    if (saving) return
    if (disabledReason) {
      showToast({ kind: 'error', message: disabledReason })
      setConfirmationCount(undefined)
      return
    }
    setSaving(true)
    try {
      if (await onDelete(expectedNodeCount)) { showToast({ kind: 'info', message: '已删除行动图' }); setConfirmationCount(undefined) }
      else showToast({ kind: 'error', message: '图状态已变化或无删除权限，请重新确认后重试' })
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '删除失败，请重试' }) }
    finally { setSaving(false) }
  }

  return (
    <section className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
      <h3 className="text-sm font-medium">删除行动图</h3>
      <AlertDialog.Root open={confirmationCount !== undefined && !disabledReason} onOpenChange={(open) => { if (!open && !saving) setConfirmationCount(undefined) }}>
        {disabledReason ? <Tooltip content={disabledReason}>
          <span className="inline-flex cursor-not-allowed rounded-md" tabIndex={0} title={`删除图：${disabledReason}`}>
            <button className="quiet-button pointer-events-none !text-coral" type="button" disabled><Trash2 size={16} />删除图</button>
          </span>
        </Tooltip> : <AlertDialog.Trigger asChild>
          <button className="quiet-button !text-coral" type="button" disabled={saving} onClick={(event) => {
            if (nodeCount === 0) { event.preventDefault(); remove(0) }
            else setConfirmationCount(nodeCount)
          }}><Trash2 size={16} />删除图</button>
        </AlertDialog.Trigger>}
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 text-ink shadow-app outline-none">
            <AlertDialog.Title className="text-base font-semibold">删除行动图？</AlertDialog.Title>
            <AlertDialog.Description className="mt-3 break-words text-sm leading-[1.8] text-copy">将删除「{title}」及其中的 {confirmationCount} 个节点，包括行动记录和表达。删除后无法恢复。</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild><button className="quiet-button" type="button" disabled={saving}>取消</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className="primary-button !bg-coral !text-white" type="button" disabled={saving} onClick={(event) => { event.preventDefault(); if (confirmationCount !== undefined) void remove(confirmationCount) }}>确认删除</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  )
}
