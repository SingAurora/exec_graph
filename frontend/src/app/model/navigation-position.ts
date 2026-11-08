/** “我的”和不指定栏目时的本人主页共享位置；明确指定内容的深链接保留独立位置。 */
export function getNavigationPositionKey(hash: string, currentUserUuid: string): string {
  const [view, search] = hash.split('?')
  const query = new URLSearchParams(search)
  if (view === 'profile' && query.get('userUuid') === currentUserUuid && !query.has('tab')) return 'my'
  return hash
}
