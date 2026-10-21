/** Own-profile aliases share a reading position; explicit content deep links keep their own entry. */
export function getNavigationPositionKey(hash: string, currentUserId: string): string {
  const [view, search] = hash.split('?')
  const query = new URLSearchParams(search)
  if (view === 'profile' && query.get('userId') === currentUserId && !query.has('tab')) return 'my'
  return hash
}
