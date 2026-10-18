import { ArrowRight } from 'lucide-react'
import type { ActionNode } from '../../entities/action/model/types'
import type { Project, UserProfile } from '../../shared/model'
import { Avatar } from '../../shared/ui/Avatar'

/** Public author information and the action graphs they have contributed to. */
export function PublicProfile({ profile, projects, actions, onOpenProject }: { profile: UserProfile; projects: Project[]; actions: ActionNode[]; onOpenProject: (id: string) => void }) {
  const authorActions = actions.filter((action) => action.authorId === profile.id)
  const graphIds = new Set(authorActions.map((action) => action.projectId))
  const relatedProjects = projects.filter((project) => project.ownerId === profile.id || project.participantIds.includes(profile.id) || graphIds.has(project.id))
  return <section className="pt-7" aria-label={`${profile.name}的主页`}>
    <header className="border-b border-line pb-6">
      <div className="flex items-center gap-4"><Avatar profile={profile} size="large" /><div><h2 className="text-[24px] font-semibold">{profile.name}</h2><p className="mt-2 text-sm leading-[1.85] text-copy">{profile.bio}</p></div></div>
      <p className="mt-5 text-xs text-muted">{authorActions.length} 条事实 · {relatedProjects.length} 个行动图</p>
    </header>
    <h3 className="mt-6 text-base font-semibold">行动图</h3>
    <div className="mt-3 divide-y divide-line border-y border-line">
      {relatedProjects.map((project) => <button className="flex w-full items-center justify-between gap-4 border-0 bg-transparent px-1 py-5 text-left hover:bg-soft" type="button" key={project.id} onClick={() => onOpenProject(project.id)}><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{project.title}</strong><span className="mt-2 block line-clamp-2 text-sm leading-[1.85] text-copy">{project.description}</span></span><ArrowRight className="flex-none text-muted" size={16} /></button>)}
      {!relatedProjects.length && <p className="py-8 text-sm text-muted">暂无行动图</p>}
    </div>
  </section>
}
