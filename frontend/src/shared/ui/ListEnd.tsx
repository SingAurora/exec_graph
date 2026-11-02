import { Check, LoaderCircle } from 'lucide-react'
import { forwardRef } from 'react'

type ListEndProps = {
  hasMore: boolean
  doneLabel?: string
  loadingLabel?: string
  className?: string
}

/** 列表底部的统一状态标记；ref 交给无限滚动观察器，后续列表直接复用。 */
export const ListEnd = forwardRef<HTMLParagraphElement, ListEndProps>(function ListEnd({
  hasMore,
  doneLabel = '没有更多了',
  loadingLabel = '加载中…',
  className = '',
}, ref) {
  return (
    <p ref={ref} className={`flex items-center justify-center gap-1.5 text-xs leading-5 text-muted ${className}`}>
      {hasMore ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
      <span>{hasMore ? loadingLabel : doneLabel}</span>
    </p>
  )
})
