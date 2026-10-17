import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Renders a record in the surrounding scroll container, without another document frame. */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return <div className="record-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown></div>
}
