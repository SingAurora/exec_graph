import type { CompletionRecord } from '../../entities/action/model/legacy-types'

export function RecordList({ records }: { records: CompletionRecord[] }) {
  return (
    <section className="pt-[38px]">
      <div><div className="section-kicker">已经发生</div><h2 id="records-title" className="mt-[7px] text-[23px] tracking-[-.03em]">完成记录</h2></div>
      <div className="mt-5 border-t border-line">
        {records.map((record) => <article className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-5" key={record.id}>
          <div className="grid text-center"><strong className="font-sans text-[26px]">{record.day}</strong><span className="text-[11px] text-muted">{record.month}</span></div>
          <div><h3 className="text-base">{record.title}</h3><p className="mt-1 text-[13px] leading-[1.7] text-muted">{record.note}</p></div><span className="text-lg text-signal">✓</span>
        </article>)}
      </div>
    </section>
  )
}
