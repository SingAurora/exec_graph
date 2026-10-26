import { ArrowLeft, ArrowRight } from 'lucide-react'

type PaginationProps = {
  currentPage: number
  pageCount: number
  onChange: (page: number) => void
}

/** Compact numbered pagination with first, last and adjacent page shortcuts. */
export function Pagination({ currentPage, pageCount, onChange }: PaginationProps) {
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])).filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right)

  return (
    <nav className="flex items-center justify-center gap-[7px] pt-6">
      <button className="grid size-8 place-items-center rounded-md border border-line bg-surface text-muted hover:border-signal hover:text-signal" type="button" title="上一页" disabled={currentPage === 1} onClick={() => onChange(currentPage - 1)}><ArrowLeft size={15} /></button>
      <div className="flex items-center gap-[7px]">{pageNumbers.map((pageNumber, index) => <span className="flex items-center gap-[7px]" key={pageNumber}>{index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span className="text-[11px] text-muted">...</span>}<button className={`grid size-8 place-items-center rounded-md border border-line bg-surface text-[11px] font-bold text-muted hover:border-signal hover:text-signal ${pageNumber === currentPage ? 'border-signal bg-signal-soft text-signal' : ''}`} type="button" title={`第 ${pageNumber} 页`} onClick={() => onChange(pageNumber)}>{pageNumber}</button></span>)}</div>
      <button className="grid size-8 place-items-center rounded-md border border-line bg-surface text-muted hover:border-signal hover:text-signal" type="button" title="下一页" disabled={currentPage === pageCount} onClick={() => onChange(currentPage + 1)}><ArrowRight size={15} /></button>
    </nav>
  )
}
