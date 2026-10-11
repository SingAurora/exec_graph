import type { Action, UserProfile } from '../../shared/model'
import { Avatar } from '../layout/AppShell'

type ActionListProps = { actions: Action[]; profile: UserProfile; onComplete: (action: Action) => void }

export function ActionList({ actions, profile, onComplete }: ActionListProps) {
  return <section className="stream-section" aria-labelledby="actions-title">
    <div className="section-heading"><div><div className="section-kicker">正在发生</div><h2 id="actions-title">我的行动</h2></div></div>
    <div className="action-stream">
      {actions.map((action) => <article className="action-post is-active-action" data-status="active" key={action.id}>
        <div className="post-avatar"><Avatar profile={profile} size="medium" /></div>
        <div className="post-body"><div className="post-topline"><strong>{profile.name}</strong><span className="profile-email">{profile.email}</span><span className="post-time">{action.createdAt}</span></div>
          <h3>{action.title}</h3><p className="post-description">{action.description}</p>
          <div className="focus-summary"><span className="focus-label">这次关注</span>{action.points.map((point) => <span key={point}>{point}</span>)}</div>
          <div className="post-footer"><span className="status-dot"><i />进行中</span><button className="post-action" type="button" onClick={() => onComplete(action)}>记录完成</button></div>
        </div>
      </article>)}
    </div>
    {!actions.length && <p className="empty-stream">这里还没有行动。先说一件今天想做的事。</p>}
  </section>
}
