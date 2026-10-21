/** Uses the first visible character of a name, capitalizing Latin initials. */
export function getAvatarLabel(name: string | undefined, fallback = 'A') {
  return Array.from(name?.trim() ?? '')[0]?.toLocaleUpperCase() || fallback
}
