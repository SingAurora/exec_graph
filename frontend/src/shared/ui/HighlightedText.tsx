import { findSearchMatch } from '../lib/search'

/** Highlights literal matches using the current theme, without injecting markup. */
export function HighlightedText({ text, query = '' }: { text: string; query?: string }) {
  const keyword = query.trim()
  if (!keyword) return text
  const parts = []
  let start = 0
  let match = findSearchMatch(text, keyword)
  while (match !== -1) {
    parts.push(text.slice(start, match))
    parts.push(<mark key={match} className="rounded-sm bg-signal-soft text-signal">{text.slice(match, match + keyword.length)}</mark>)
    start = match + keyword.length
    match = findSearchMatch(text, keyword, start)
  }
  parts.push(text.slice(start))
  return <>{parts}</>
}
