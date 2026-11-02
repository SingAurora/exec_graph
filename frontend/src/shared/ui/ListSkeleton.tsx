type ListSkeletonProps = {
  rows?: number
  compact?: boolean
  className?: string
}

/** 列表查询中的统一占位骨架；只保留版式，不伪造任何业务内容。 */
export function ListSkeleton({ rows = 4, compact = false, className = '' }: ListSkeletonProps) {
  const count = Math.max(1, Math.min(rows, 12))
  return (
    <div className={`grid gap-5 ${className}`}>
      <span className="sr-only">正在加载列表</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="flex gap-3 motion-safe:animate-pulse" key={index}>
          <span className={`shrink-0 rounded-[9px] bg-line ${compact ? 'size-8' : 'size-10'}`} />
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <div className="h-2.5 w-2/3 rounded bg-line" />
            <div className="h-2 w-full rounded bg-line/70" />
            <div className="h-2 w-4/5 rounded bg-line/70" />
          </div>
        </div>
      ))}
    </div>
  )
}
