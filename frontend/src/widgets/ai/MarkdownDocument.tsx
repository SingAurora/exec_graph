type MarkdownDocumentProps = {
  markdown: string
  label: string
  empty?: string
}

export function MarkdownDocument({ markdown, label, empty = '文档会在对话中生成。' }: MarkdownDocumentProps) {
  const lines = markdown ? markdown.split('\n') : []

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-[21px] py-[19px]"><div><span className="font-sans text-[10px] font-bold uppercase tracking-[.12em] text-signal">AI 生成</span><h2 className="mt-1 text-[17px]">{label}</h2></div><span className="text-[11px] text-muted">只读文档</span></div>
      <div className="flex-1 overflow-auto px-[27px] pb-9 pt-[25px] max-[700px]:px-5 max-[700px]:pb-[30px] max-[700px]:pt-[22px]">
        {!lines.length && <p className="text-[13px] text-muted">{empty}</p>}
        {lines.map((line, index) => {
          if (!line.trim()) return (
            <div className="h-1" key={`${line}-${index}`} />
          )
          if (line.startsWith('# ')) return (
            <h1 className="font-sans text-2xl tracking-[-.04em]" key={index}>{line.slice(2)}</h1>
          )
          if (line.startsWith('## ')) return (
            <h3 className="mt-[25px] text-[13px] text-signal-dark" key={index}>{line.slice(3)}</h3>
          )
          if (line.startsWith('- ')) return (
            <li className="ml-[18px] mt-[7px] text-[13px] leading-[1.8] text-ink" key={index}>{line.slice(2)}</li>
          )
          return (
            <p className="mt-2 text-[13px] leading-[1.8] text-ink" key={index}>{line}</p>
          )
        })}
      </div>
    </section>
  )
}
