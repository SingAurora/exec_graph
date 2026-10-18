import { ProjectAvatar } from '../entities/project/ui/ProjectAvatar'
import { ArrowRight, CheckCircle2, CircleDot } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDateTime } from '../shared/lib/date'
import type { ActionTopic, CompletionNode, PlanNode, Project, UserProfile } from '../shared/model'

type MyPageProps = {
  profile: UserProfile
  projects: Project[]
  plans: PlanNode[]
  completions: CompletionNode[]
  topics: ActionTopic[]
  onOpenProject: (projectId: string) => void
  onOpenPlan: (plan: PlanNode) => void
  onOpenCompletion: (completion: CompletionNode) => void
}

export function MyPage({ profile, projects, plans, completions, topics, onOpenProject, onOpenPlan, onOpenCompletion }: MyPageProps) {
  const activePlans = plans.filter((plan) => plan.status === 'active')
  const ownedProjects = projects.filter((project) => project.ownerId === profile.id)
  const joinedProjects = projects.filter((project) => project.ownerId !== profile.id && project.participantIds.includes(profile.id))
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const recentPlans = plans.slice(0, 3)
  const recentCompletions = completions.slice(0, 3)

  return <section className="pt-[38px] max-[700px]:pt-7">
    <header className="flex items-end justify-between gap-6 pb-[27px] max-[700px]:items-stretch max-[700px]:flex-col"><div><h2 className="text-[26px] tracking-[-.04em]">{profile.name}，继续手上的事情</h2><p className="mt-2 text-sm leading-[1.7] text-muted">回到最近的行动，或从已有节点接续。</p></div></header>

    <section className="grid grid-cols-5 border-y border-line bg-surface max-[700px]:grid-cols-2" aria-label="工作台数据"><Metric value={ownedProjects.length} label="发起行动图" /><Metric value={joinedProjects.length} label="参与行动图" /><Metric value={activePlans.length} label="进行中计划" /><Metric value={completions.length} label="完成记录" /><Metric value={profile.activeDays} label="活跃天数" /></section>

    <DashboardSection title="最近行动图">
      <div className="mt-[17px] border-t border-line">{projects.slice(0, 3).map((project) => { const projectTopics = topics.filter((topic) => topic.projectId === project.id); const projectPlans = plans.filter((plan) => projectTopics.some((topic) => topic.id === plan.topicId)); const projectCompletions = completions.filter((completion) => projectTopics.some((topic) => topic.id === completion.topicId)); const relation = project.ownerId === profile.id ? '我发起的' : '我参与的'; return <button className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3.5 border-0 border-b border-line bg-transparent px-1 py-[17px] text-left text-ink hover:bg-soft max-[700px]:grid-cols-[36px_minmax(0,1fr)]" type="button" onClick={() => onOpenProject(project.id)} key={project.id}><ProjectAvatar project={project} size="compact" /><span className="grid min-w-0 gap-1"><strong className="text-sm">{project.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted">{project.description}</small><span className="text-[10px] font-bold text-signal">{relation} · {projectPlans.filter((plan) => plan.status === 'active').length} 项进行中 · {projectCompletions.length} 条完成记录</span></span><span className="flex items-center gap-2.5 text-[11px] text-muted max-[700px]:col-start-2 max-[700px]:justify-between">{formatDateTime(project.updatedAt)}<ArrowRight className="text-signal" size={16} /></span></button> })}</div>
    </DashboardSection>

    <div className="grid grid-cols-2 gap-9 max-[700px]:grid-cols-1 max-[700px]:gap-0.5">
      <DashboardSection title="最近计划">
        <div className="mt-4 border-t border-line">{recentPlans.map((plan) => <button className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 border-b border-line bg-transparent px-0.5 py-3.5 text-left text-ink hover:bg-soft" type="button" onClick={() => onOpenPlan(plan)} key={plan.id}><span className="grid size-7 place-items-center rounded-md bg-signal-soft text-signal"><CircleDot size={15} /></span><span className="grid min-w-0 gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{plan.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{topicById.get(plan.topicId)?.title}</small></span><span className="text-[10px] font-bold text-signal">{plan.status === 'active' ? '进行中' : '已完成'}</span></button>)}{!recentPlans.length && <p className="py-[25px] text-[13px] text-muted">还没有计划。</p>}</div>
      </DashboardSection>
      <DashboardSection title="最近完成">
        <div className="mt-4 border-t border-line">{recentCompletions.map((completion) => <button className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 border-b border-line bg-transparent px-0.5 py-3.5 text-left text-ink hover:bg-soft" type="button" onClick={() => onOpenCompletion(completion)} key={completion.id}><span className="grid size-7 place-items-center rounded-md bg-[#edf1f5] text-[#4c6a7b] dark:bg-[#2a353b] dark:text-[#a9c3d0]"><CheckCircle2 size={15} /></span><span className="grid min-w-0 gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{completion.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{topicById.get(completion.topicId)?.title}</small></span><ArrowRight className="text-signal" size={15} /></button>)}{!recentCompletions.length && <p className="py-[25px] text-[13px] text-muted">还没有完成记录。</p>}</div>
      </DashboardSection>
    </div>
  </section>
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="grid gap-[5px] border-r border-line px-5 py-[18px] last:border-r-0 max-[700px]:nth-[2n]:border-r-0 max-[700px]:nth-[-n+4]:border-b max-[700px]:last:col-span-full"><strong className="font-sans text-[27px]">{value}</strong><span className="text-[11px] text-muted">{label}</span></div> }

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="pt-[38px]"><div><h2 className="text-[25px] tracking-[-.03em] max-[700px]:text-[22px]">{title}</h2></div>{children}</section>
}
