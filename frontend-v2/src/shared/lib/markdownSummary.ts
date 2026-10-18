/** Creates plain summary text; visual line clamping leaves the complete document intact. */
export function getMarkdownSummary(markdown: string, title?: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[^\n]*\n?|```/g, '')
    .split('\n')
    .filter((line) => !/^#{1,6}\s/.test(line) || line.replace(/^#{1,6}\s*/, '').trim() !== title?.trim())
    .map((line) => line.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '').replace(/[*_`~]/g, '').trim())
    .filter(Boolean)
    .join(' ')
}
