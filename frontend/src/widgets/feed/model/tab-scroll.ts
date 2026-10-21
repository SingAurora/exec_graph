/** Keeps the profile navigation stable while restoring reading positions below it. */
export function getActivityTabScrollTop(savedTop: number | undefined, currentTop: number, navigationTop: number): number {
  if (currentTop < navigationTop) return currentTop
  return Math.max(savedTop ?? navigationTop, navigationTop)
}
