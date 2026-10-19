import { BookmarkPlus, Check, UserPlus } from 'lucide-react'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { useToast } from '../../../shared/ui/toast/useToast'

type Props = {
  kind: 'graph' | 'user'
  name: string
  following: boolean
  disabledReason?: string
  onChange: (following: boolean) => boolean
}

/** Follows an object explicitly, with a recoverable unsubscribe and shared feedback. */
export function FollowButton({ kind, name, following, disabledReason, onChange }: Props) {
  const { showToast } = useToast()
  const change = () => {
    if (disabledReason) return
    const next = !following
    if (!onChange(next)) return
    showToast({ message: next ? `已关注${kind === 'graph' ? '图' : ''}「${name}」` : `已取消关注「${name}」`,
      duration: next ? undefined : 5000,
      action: next ? undefined : { label: '撤销', onClick: () => {
        if (onChange(true)) showToast({ message: '已恢复关注' })
        else showToast({ kind: 'warning', message: '对象已不可关注' })
      } },
    })
  }
  const Icon = following ? Check : kind === 'graph' ? BookmarkPlus : UserPlus
  const button = <button type="button" className={following || disabledReason ? 'quiet-button shrink-0' : 'primary-button shrink-0'} aria-label={`${following ? '取消关注' : '关注'}${kind === 'graph' ? '图' : '用户'}：${name}${disabledReason ? `，${disabledReason}` : ''}`} aria-pressed={following} disabled={Boolean(disabledReason)} onClick={change}><Icon size={15} />{following ? '已关注' : '关注'}</button>
  return disabledReason ? <Tooltip content={disabledReason}><span className="inline-flex" tabIndex={0}>{button}</span></Tooltip> : button
}
