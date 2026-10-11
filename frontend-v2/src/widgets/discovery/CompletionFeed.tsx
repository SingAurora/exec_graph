import type { DiscoveryPost } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type CompletionFeedProps = { posts: DiscoveryPost[]; onToggleFollow: (id: string) => void; followingOnly?: boolean }

export function CompletionFeed({ posts, onToggleFollow, followingOnly = false }: CompletionFeedProps) {
  const visiblePosts = followingOnly ? posts.filter((post) => post.following) : posts
  return <div className="completion-feed">
    {visiblePosts.map((post) => <article className="completion-card" key={post.id}>
      <div className="completion-author"><Avatar label={post.avatar} size="medium" tone={post.avatarTone} /><div><strong>{post.name}</strong><span>{post.time}</span></div></div>
      <h3>{post.title}</h3><p>{post.note}</p>
      <div className="completion-footer"><span>完成记录</span>{followingOnly ? <span className="following-label">已关注</span> : <button className={`follow-button ${post.following ? 'is-following' : ''}`} type="button" onClick={() => onToggleFollow(post.id)}>{post.following ? '已关注' : '关注'}</button>}</div>
    </article>)}
    {!visiblePosts.length && <p className="empty-stream">还没有关注的人。去发现里看看大家完成了什么。</p>}
  </div>
}

export function DiscoveryPage({ posts, onToggleFollow }: CompletionFeedProps) {
  return <section className="people-section" aria-labelledby="people-title"><div className="section-heading"><div><div className="section-kicker">看看大家完成了什么</div><h2 id="people-title">发现</h2></div></div><CompletionFeed posts={posts} onToggleFollow={onToggleFollow} /></section>
}
