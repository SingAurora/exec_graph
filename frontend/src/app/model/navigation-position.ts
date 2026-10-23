/** “我的”和不指定栏目时的本人主页共享位置；明确指定内容的深链接保留独立位置。 */
export function getNavigationPositionKey(hash: string, currentUserId: string): string {
  const [view, search] = hash.split('?')
  const query = new URLSearchParams(search)
  if (view === 'profile' && query.get('userId') === currentUserId && !query.has('tab')) return 'my'
  return hash
}
