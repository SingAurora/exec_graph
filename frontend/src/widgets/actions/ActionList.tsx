import type { Action } from '../../entities/action/model/legacy-types'
import type { UserProfile } from '../../entities/profile/model/types'
import { Avatar } from '../../shared/ui/Avatar'

type ActionListProps = { actions: Action[]; profile: UserProfile; onComplete: (action: Action) => void }

export function ActionList({ actions, profile, onComplete }: ActionListProps) {
  return (
    <section className="pt-[38px]">
      <div><div className="section-kicker">正在发生</div><h2 id="actions-title" className="mt-[7px] text-[23px] tracking-[-.03em]">我的行动</h2></div>
      <div className="mt-5 grid gap-0 border-t border-line">
        {actions.map((action) => <article className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-line py-6" data-status="active" key={action.id}>
          <div><Avatar profile={profile} size="medium" /></div>
          <div><div className="flex items-center gap-2 text-xs"><strong>{profile.name}</strong><span className="text-muted">{profile.email}</span><span className="ml-auto text-[11px] text-muted">{action.createdAt}</span></div>
            <h3 className="mt-3 text-base">{action.title}</h3><p className="mt-1 text-[13px] leading-[1.7] text-muted">{action.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span className="font-bold text-signal">这次关注</span>{action.points.map((point) => <span className="rounded bg-soft px-2 py-1" key={point}>{point}</span>)}</div>
            <div className="mt-4 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-xs text-signal"><i className="size-1.5 rounded-full bg-signal" />进行中</span><button className="text-xs font-bold text-signal hover:text-signal-dark" type="button" onClick={() => onComplete(action)}>记录完成</button></div>
          </div>
        </article>)}
      </div>
      {!actions.length && <p className="py-[25px] text-[13px] text-muted">这里还没有行动。先说一件今天想做的事。</p>}
    </section>
  )
}
