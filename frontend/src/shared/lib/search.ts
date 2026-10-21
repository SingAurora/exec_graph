/** Locates literal, case-insensitive keywords without interpreting them as a pattern. */
export function findSearchMatch(text: string, query: string, fromIndex = 0): number {
  const keyword = query.trim().toLocaleLowerCase()
  return keyword ? text.toLocaleLowerCase().indexOf(keyword, fromIndex) : -1
}

/** Starts the summary near its first match while leaving the full text available for line clamping. */
export function getSearchExcerpt(text: string, query: string): string {
  const match = findSearchMatch(text, query)
  const start = Math.max(0, match - 30)
  return start ? `…${text.slice(start)}` : text
}
