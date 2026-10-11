import { ArrowLeft, ArrowRight, CheckCircle2, CircleDot, Plus } from 'lucide-react'
import type { ActionTopic, CompletionNode, PlanNode, Project } from '../shared/model'

type ProjectPageProps = {
  project: Project
  currentUserId: string
  topics: ActionTopic[]
  plans: PlanNode[]
  completions: CompletionNode[]
  backLabel: string
  onBack: () => void
  onCreatePlan: (projectId: string) => void
  onOpenPlan: (plan: PlanNode) => void
  onOpenCompletion: (completion: CompletionNode) => void
}

export function ProjectPage({ project, currentUserId, topics, plans, completions, backLabel, onBack, onCreatePlan, onOpenPlan, onOpenCompletion }: ProjectPageProps) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const activePlans = plans.filter((plan) => plan.status === 'active')
  const latestPlan = activePlans[0]
  const latestCompletion = completions[0]

  return <section className="project-page"><button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} />{backLabel}</button>
    <header className="project-header"><div><span className="section-kicker">{project.ownerId === currentUserId ? '我创建的项目' : '我参与的项目'}</span><h2>{project.title}</h2><p>{project.description}</p></div><button className="primary-button" type="button" onClick={() => onCreatePlan(project.id)}><Plus size={16} />创建计划</button></header>
    {(latestPlan || latestCompletion) && <section className="latest-interaction"><span className="section-kicker">继续最近互动</span>{latestPlan ? <button type="button" onClick={() => onOpenPlan(latestPlan)}><span className="latest-node-icon"><CircleDot size={17} /></span><span><strong>{latestPlan.title}</strong><small>计划正在进行，返回与 AI 的最近互动</small></span><ArrowRight size={17} /></button> : latestCompletion && <button type="button" onClick={() => onOpenCompletion(latestCompletion)}><span className="latest-node-icon completion"><CheckCircle2 size={17} /></span><span><strong>{latestCompletion.title}</strong><small>打开最近生成的完成记录</small></span><ArrowRight size={17} /></button>}</section>}
    <div className="project-columns"><section><div className="section-heading"><div><span className="section-kicker">项目节点</span><h2>最近计划</h2></div></div><div className="compact-list project-compact-list">{plans.map((plan) => <button type="button" onClick={() => onOpenPlan(plan)} key={plan.id}><span className="compact-icon plan"><CircleDot size={15} /></span><span><strong>{plan.title}</strong><small>{topicById.get(plan.topicId)?.title}</small></span><span className="compact-state">{plan.status === 'active' ? '进行中' : '已完成'}</span></button>)}{!plans.length && <p className="empty-state">还没有计划。</p>}</div></section><section><div className="section-heading"><div><span className="section-kicker">项目节点</span><h2>最近完成</h2></div></div><div className="compact-list project-compact-list">{completions.map((completion) => <button type="button" onClick={() => onOpenCompletion(completion)} key={completion.id}><span className="compact-icon completion"><CheckCircle2 size={15} /></span><span><strong>{completion.title}</strong><small>{topicById.get(completion.topicId)?.title}</small></span><ArrowRight className="compact-arrow" size={15} /></button>)}{!completions.length && <p className="empty-state">还没有完成记录。</p>}</div></section></div>
  </section>
}
