import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownContentProps = {
  content: string
  className?: string
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-display text-2xl font-semibold leading-tight text-ink">{children}</h1>,
          h2: ({ children }) => <h2 className="font-display text-xl font-semibold leading-tight text-ink">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold leading-6 text-ink">{children}</h3>,
          p: ({ children }) => <p className="leading-6 text-graphite">{children}</p>,
          ul: ({ children }) => <ul className="grid list-disc gap-1.5 pl-5 marker:text-signal">{children}</ul>,
          ol: ({ children }) => <ol className="grid list-decimal gap-1.5 pl-5 marker:font-semibold marker:text-signal">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-6 text-ink">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-signal/50 pl-4 italic text-graphite">{children}</blockquote>,
          a: ({ href, children }) => <a className="font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:text-ink" href={href} target="_blank" rel="noreferrer">{children}</a>,
          img: ({ src, alt }) => <img src={src ?? ''} alt={alt ?? ''} className="max-h-[420px] w-auto max-w-full rounded-md border border-rail object-contain" loading="lazy" />,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-inverse p-4 font-mono text-xs leading-6 text-white">{children}</pre>,
          code: ({ children }) => <code className="rounded bg-rail/50 px-1.5 py-0.5 font-mono text-[0.9em] text-inherit">{children}</code>,
          hr: () => <hr className="border-rail" />,
          table: ({ children }) => <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-rail bg-paper px-3 py-2 font-semibold text-ink">{children}</th>,
          td: ({ children }) => <td className="border border-rail px-3 py-2 text-graphite">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
