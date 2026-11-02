import { Check, Clipboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type CopyStatus = 'idle' | 'copied' | 'failed'

/** 复制对话文本的通用按钮；复制成功后短暂显示结果，不弹出全局提示。 */
export function CopyConversationButton({ text, label = '复制对话', title = '复制当前对话内容', className = 'quiet-button', iconOnly = false }: {
  text: string
  label?: string
  title?: string
  className?: string
  iconOnly?: boolean
}) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), 1800)
  }

  return (
    <button className={className} type="button" onClick={copy} title={status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : title}>
      {status === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
      {!iconOnly && (status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : label)}
    </button>
  )
}
