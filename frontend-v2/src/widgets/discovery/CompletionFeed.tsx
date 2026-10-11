import type { DiscoveryPost } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type CompletionFeedProps = { posts: DiscoveryPost[]; onToggleFollow: (id: string) => void; followingOnly?: boolean }

export function CompletionFeed({ posts, onToggleFollow, followingOnly = false }: CompletionFeedProps) {
  const visiblePosts = followingOnly ? posts.filter((post) => post.following) : posts
  return <div className="border-t border-line">
    {visiblePosts.map((post) => <article className="border-b border-line py-6" key={post.id}>
      <div className="flex items-center gap-2.5"><Avatar label={post.avatar} size="medium" tone={post.avatarTone} /><div className="grid gap-1"><strong className="text-[13px]">{post.name}</strong><span className="text-[11px] text-muted">{post.time}</span></div></div>
      <h3 className="mt-4 text-lg tracking-[-.02em]">{post.title}</h3><p className="mt-2 text-sm leading-[1.8] text-muted">{post.note}</p>
      <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted"><span>完成记录</span>{followingOnly ? <span className="text-signal">已关注</span> : <button className={`border-0 bg-transparent p-0 text-xs font-bold text-signal ${post.following ? 'text-muted' : ''}`} type="button" onClick={() => onToggleFollow(post.id)}>{post.following ? '已关注' : '关注'}</button>}</div>
    </article>)}
    {!visiblePosts.length && <p className="py-[25px] text-[13px] text-muted">还没有关注的人。去发现里看看大家完成了什么。</p>}
  </div>
}

export function DiscoveryPage({ posts, onToggleFollow }: CompletionFeedProps) {
  return <section aria-labelledby="people-title"><div className="mb-[22px]"><div className="section-kicker">看看大家完成了什么</div><h2 id="people-title" className="mt-[7px] text-[23px] tracking-[-.03em]">发现</h2></div><CompletionFeed posts={posts} onToggleFollow={onToggleFollow} /></section>
}
