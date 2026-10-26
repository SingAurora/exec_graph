import { BookmarkPlus, Check, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { useToast } from '../../../shared/ui/toast/useToast'

type Props = {
  kind: 'graph' | 'user'
  name: string
  following: boolean
  disabledReason?: string
  onChange: (following: boolean) => boolean | Promise<boolean>
}

/** Follows an object explicitly, with a recoverable unsubscribe and shared feedback. */
export function FollowButton({ kind, name, following, disabledReason, onChange }: Props) {
  const { showToast } = useToast()
  const pending = useRef(false)
  const [saving, setSaving] = useState(false)
  const change = async (next: boolean, undo = false) => {
    if (disabledReason || pending.current) return
    pending.current = true; setSaving(true)
    try {
      if (!await onChange(next)) { if (undo) showToast({ kind: 'warning', message: '对象已不可关注' }); return }
      if (undo) { showToast({ message: '已恢复关注' }); return }
      showToast({ message: next ? `已关注${kind === 'graph' ? '图' : ''}「${name}」` : `已取消关注「${name}」`,
      duration: next ? undefined : 4000,
      action: next ? undefined : { label: '撤销', onClick: () => { void change(true, true) } },
      })
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '关注操作失败，请重试' }) }
    finally { pending.current = false; setSaving(false) }
  }
  const Icon = following ? Check : kind === 'graph' ? BookmarkPlus : UserPlus
  const button = <button type="button" className={following || disabledReason ? 'quiet-button shrink-0' : 'primary-button shrink-0'} aria-label={`${following ? '取消关注' : '关注'}${kind === 'graph' ? '图' : '用户'}：${name}${disabledReason ? `，${disabledReason}` : ''}`} aria-pressed={following} disabled={Boolean(disabledReason) || saving} onClick={() => { void change(!following) }}><Icon size={15} />{following ? '已关注' : '关注'}</button>
  return (
    disabledReason ? <Tooltip content={disabledReason}><span className="inline-flex" tabIndex={0}>{button}</span></Tooltip> : button
  )
}
