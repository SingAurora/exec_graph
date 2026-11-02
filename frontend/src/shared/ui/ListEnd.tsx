import { LoaderCircle } from 'lucide-react'
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
    <p ref={ref} className={`flex items-center gap-3 text-xs leading-5 text-muted/70 ${className}`}>
      <span className="h-px min-w-6 flex-1 bg-gradient-to-r from-transparent to-line/60" />
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-normal">
        {hasMore && <LoaderCircle size={13} className="animate-spin text-signal/60" />}
        <span>{hasMore ? loadingLabel : doneLabel}</span>
      </span>
      <span className="h-px min-w-6 flex-1 bg-gradient-to-l from-transparent to-line/60" />
    </p>
  )
})
