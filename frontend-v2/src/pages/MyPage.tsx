import type { AppView, Action, CompletionRecord, UserProfile } from '../shared/model'
import { ActionComposer } from '../widgets/actions/ActionComposer'
import { ActionList } from '../widgets/actions/ActionList'
import { CompletionFeed } from '../widgets/discovery/CompletionFeed'
import { ProfileHeader } from '../widgets/profile/ProfileHeader'
import { RecordList } from '../widgets/records/RecordList'

type MyPageProps = {
  view: AppView
  profile: UserProfile
  actions: Action[]
  records: CompletionRecord[]
  posts: Parameters<typeof CompletionFeed>[0]['posts']
  onNavigate: (view: AppView) => void
  onCreate: (action: Action) => void
  onComplete: (action: Action) => void
  onToggleFollow: (id: string) => void
}

export function MyPage({ view, profile, actions, records, posts, onNavigate, onCreate, onComplete, onToggleFollow }: MyPageProps) {
  return <>
    <ProfileHeader profile={profile} activeCount={actions.length} completedCount={records.length + 6} activeView={view} onNavigate={onNavigate} />
    {view === 'home' && <section className="home-section" aria-labelledby="home-title"><div className="section-kicker">个人首页</div><h2 id="home-title">最近发生</h2><div className="home-summary"><div><strong>{actions.length}</strong><span>项行动进行中</span></div><div><strong>{records.length + 6}</strong><span>条完成记录</span></div></div><p className="home-note">从今天开始，留下你正在做的事情，也留下已经认真完成的事情。</p></section>}
    {view === 'today' && <ActionComposer onCreate={(action) => { onCreate(action); onNavigate('actions') }} />}
    {view === 'actions' && <ActionList actions={actions} profile={profile} onComplete={onComplete} />}
    {view === 'records' && <RecordList records={records} />}
    {view === 'following' && <section className="following-section" aria-labelledby="following-title"><div className="section-heading"><div><div className="section-kicker">你关注的人</div><h2 id="following-title">关注</h2></div></div><CompletionFeed posts={posts} onToggleFollow={onToggleFollow} followingOnly /></section>}
    {view === 'today' && <TodayRail actions={actions} />}
  </>
}

function TodayRail({ actions }: { actions: Action[] }) {
  return <aside className="right-rail" aria-label="今天的概览"><section className="rail-block today-block"><div className="section-kicker">今天</div><strong className="today-number">0<span> / {Math.max(actions.length, 1)}</span></strong><p>先完成眼前的一件事，完成后再决定下一件。</p><div className="progress-line"><span /></div></section><p className="rail-note">行动不需要被说得很大。<br />先认真完成眼前的一件事。</p></aside>
}
