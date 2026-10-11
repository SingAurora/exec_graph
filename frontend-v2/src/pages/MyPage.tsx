import { ArrowRight, CheckCircle2, CircleDot, FolderKanban } from 'lucide-react'
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

  return <section className="dashboard-page">
    <header className="dashboard-welcome"><div><h2>{profile.name}，继续手上的事情</h2><p>从最近一次互动回来，或者在已有项目里开始一条新计划。</p></div></header>

    <section className="metric-grid" aria-label="工作台数据"><Metric value={ownedProjects.length} label="我创建的项目" /><Metric value={joinedProjects.length} label="我参与的项目" /><Metric value={activePlans.length} label="进行中计划" /><Metric value={completions.length} label="完成记录" /><Metric value={profile.activeDays} label="活跃天数" /></section>

    <DashboardSection title="最近项目">
      <div className="project-list">{projects.slice(0, 3).map((project) => { const projectTopics = topics.filter((topic) => topic.projectId === project.id); const projectPlans = plans.filter((plan) => projectTopics.some((topic) => topic.id === plan.topicId)); const projectCompletions = completions.filter((completion) => projectTopics.some((topic) => topic.id === completion.topicId)); const relation = project.ownerId === profile.id ? '我创建的' : '我参与的'; return <button className="project-row" type="button" onClick={() => onOpenProject(project.id)} key={project.id}><span className="project-icon"><FolderKanban size={18} /></span><span className="project-copy"><strong>{project.title}</strong><small>{project.description}</small><span>{relation} · {projectPlans.filter((plan) => plan.status === 'active').length} 项进行中 · {projectCompletions.length} 条完成记录</span></span><span className="project-updated">{formatDateTime(project.updatedAt)}<ArrowRight size={16} /></span></button> })}</div>
    </DashboardSection>

    <div className="dashboard-columns">
      <DashboardSection title="最近计划">
        <div className="compact-list">{recentPlans.map((plan) => <button type="button" onClick={() => onOpenPlan(plan)} key={plan.id}><span className="compact-icon plan"><CircleDot size={15} /></span><span><strong>{plan.title}</strong><small>{topicById.get(plan.topicId)?.title}</small></span><span className="compact-state">{plan.status === 'active' ? '进行中' : '已完成'}</span></button>)}{!recentPlans.length && <p className="empty-state">还没有计划。</p>}</div>
      </DashboardSection>
      <DashboardSection title="最近完成">
        <div className="compact-list">{recentCompletions.map((completion) => <button type="button" onClick={() => onOpenCompletion(completion)} key={completion.id}><span className="compact-icon completion"><CheckCircle2 size={15} /></span><span><strong>{completion.title}</strong><small>{topicById.get(completion.topicId)?.title}</small></span><ArrowRight className="compact-arrow" size={15} /></button>)}{!recentCompletions.length && <p className="empty-state">还没有完成记录。</p>}</div>
      </DashboardSection>
    </div>
  </section>
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="metric-item"><strong>{value}</strong><span>{label}</span></div> }

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="dashboard-section"><div className="section-heading"><h2>{title}</h2></div>{children}</section>
}
