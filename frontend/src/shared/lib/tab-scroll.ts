/** Keeps visible navigation in place and restores a tab's saved reading position below it. */
export function getRetainedTabScrollTop(savedTop: number | undefined, currentTop: number, navigationTop: number): number {
  if (currentTop < navigationTop) return currentTop
  return Math.max(savedTop ?? navigationTop, navigationTop)
}
