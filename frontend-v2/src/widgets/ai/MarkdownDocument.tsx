type MarkdownDocumentProps = {
  markdown: string
  label: string
  empty?: string
}

export function MarkdownDocument({ markdown, label, empty = '文档会在对话中生成。' }: MarkdownDocumentProps) {
  const lines = markdown ? markdown.split('\n') : []

  return <section className="document-panel" aria-label={label}>
    <div className="document-panel-header"><div><span className="document-label">AI 生成</span><h2>{label}</h2></div><span className="document-readonly">只读文档</span></div>
    <div className="markdown-document">
      {!lines.length && <p className="document-empty">{empty}</p>}
      {lines.map((line, index) => {
        if (!line.trim()) return <div className="markdown-space" key={`${line}-${index}`} />
        if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h3 key={index}>{line.slice(3)}</h3>
        if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>
        return <p key={index}>{line}</p>
      })}
    </div>
  </section>
}
