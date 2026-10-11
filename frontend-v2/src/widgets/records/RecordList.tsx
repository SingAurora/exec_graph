import type { CompletionRecord } from '../../shared/model'

export function RecordList({ records }: { records: CompletionRecord[] }) {
  return <section className="records-section" aria-labelledby="records-title">
    <div className="section-heading"><div><div className="section-kicker">已经发生</div><h2 id="records-title">完成记录</h2></div></div>
    <div className="record-list">
      {records.map((record) => <article className="record-item" key={record.id}>
        <div className="record-date"><strong>{record.day}</strong><span>{record.month}</span></div>
        <div><h3>{record.title}</h3><p>{record.note}</p></div><span className="record-check">✓</span>
      </article>)}
    </div>
  </section>
}
