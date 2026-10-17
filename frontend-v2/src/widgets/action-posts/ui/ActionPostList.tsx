import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import type { UserProfile } from '../../../shared/model'
import { Avatar } from '../../../shared/ui/Avatar'

export type ActionPost = {
  node: ActionNode
  summary: string
  pathLength: number
  participantCount: number
  mergedCount: number
}

type ActionPostListProps = {
  posts: ActionPost[]
  users: UserProfile[]
  category: 'featured' | 'hot' | 'latest'
  onOpenPost: (post: ActionPost) => void
  onCreate: () => void
}

/** Renders the fixed Tieba-like post list for an action graph. */
export function ActionPostList({ posts, users, category, onOpenPost, onCreate }: ActionPostListProps) {
  const userById = new Map(users.map((user) => [user.id, user]))
  if (!posts.length) return <EmptyPostList category={category} onCreate={onCreate} />
  return <section className="border-y border-line" aria-label={`${categoryLabel(category)}帖子列表`}>
    {posts.map((post) => <button className="group grid w-full gap-3 border-0 border-b border-line bg-transparent px-1 py-5 text-left last:border-b-0 hover:bg-soft" type="button" key={post.node.id} onClick={() => onOpenPost(post)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h3 className="truncate text-[16px] font-semibold tracking-[-.02em] group-hover:text-signal">{post.node.title}</h3><p className="post-summary-clamp mt-2 max-w-[690px] text-[13px] leading-[1.75] text-muted">{post.summary}</p></div>
        <ArrowRight className="mt-1 flex-none text-muted transition group-hover:translate-x-0.5 group-hover:text-signal" size={17} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-2"><Avatar profile={userById.get(post.node.authorId)} label={post.node.authorId.slice(0, 1).toUpperCase()} size="tiny" /><strong className="font-medium text-ink">{userById.get(post.node.authorId)?.name ?? post.node.authorId}</strong></span>
        <span>节点 {post.pathLength}</span><span>{post.participantCount} 人接续</span>{post.mergedCount > 0 && <span>合入 {post.mergedCount} 条路线</span>}<time dateTime={post.node.createdAt}>{formatPostDate(post.node.createdAt)}</time>
      </div>
      {post.node.images.length > 0 && <div className="flex gap-1.5">{post.node.images.slice(0, 3).map((image) => <img className="size-14 rounded border border-line object-cover" src={image.url} alt={image.alt} key={image.url} loading="lazy" />)}</div>}
    </button>)}
  </section>
}

function EmptyPostList({ category, onCreate }: { category: ActionPostListProps['category']; onCreate: () => void }) {
  const content = {
    featured: ['还没有精华帖子', '等一条行动链形成清晰的表达后，它会出现在这里。'],
    hot: ['还没有热门帖子', '等更多人接续和回应后，这里会出现正在升温的表达。'],
    latest: ['还没有帖子', '记录第一条行动，形成表达后就会出现在这里。'],
  }[category]
  return <div className="border-y border-line py-16 text-center"><Sparkles size={22} className="mx-auto text-signal" /><h3 className="mt-3 text-[17px]">{content[0]}</h3><p className="mt-2 text-[13px] text-muted">{content[1]}</p><button className="primary-button mt-5" type="button" onClick={onCreate}><Plus size={15} />记录第一条行动</button></div>
}

function categoryLabel(category: ActionPostListProps['category']) {
  return category === 'featured' ? '精华' : category === 'hot' ? '热门' : '最新'
}

function formatPostDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
