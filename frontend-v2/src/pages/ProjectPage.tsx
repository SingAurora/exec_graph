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

  return <section className="max-w-[850px] pt-[38px] max-[700px]:pt-7"><button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />{backLabel}</button>
    <header className="flex items-end justify-between gap-6 border-b border-line py-7 pb-[25px] max-[700px]:items-stretch max-[700px]:flex-col"><div><span className="section-kicker">{project.ownerId === currentUserId ? '我创建的项目' : '我参与的项目'}</span><h2 className="mt-[7px] text-[27px] tracking-[-.04em]">{project.title}</h2><p className="mt-2 max-w-[610px] text-[13px] leading-[1.7] text-muted">{project.description}</p></div><button className="primary-button max-[700px]:w-full" type="button" onClick={() => onCreatePlan(project.id)}><Plus size={16} />创建计划</button></header>
    {(latestPlan || latestCompletion) && <section className="pt-[27px]"><span className="section-kicker">继续最近互动</span>{latestPlan ? <button className="mt-[11px] grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-[13px] rounded-[7px] border border-line bg-surface p-[17px] text-left text-ink hover:border-signal" type="button" onClick={() => onOpenPlan(latestPlan)}><span className="grid size-9 place-items-center rounded-md bg-signal-soft text-signal"><CircleDot size={17} /></span><span className="grid gap-1"><strong className="text-sm">{latestPlan.title}</strong><small className="text-[11px] text-muted">计划正在进行，返回与 AI 的最近互动</small></span><ArrowRight className="text-signal" size={17} /></button> : latestCompletion && <button className="mt-[11px] grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-[13px] rounded-[7px] border border-line bg-surface p-[17px] text-left text-ink hover:border-signal" type="button" onClick={() => onOpenCompletion(latestCompletion)}><span className="grid size-9 place-items-center rounded-md bg-[#edf1f5] text-[#4c6a7b] dark:bg-[#2a353b] dark:text-[#a9c3d0]"><CheckCircle2 size={17} /></span><span className="grid gap-1"><strong className="text-sm">{latestCompletion.title}</strong><small className="text-[11px] text-muted">打开最近生成的完成记录</small></span><ArrowRight className="text-signal" size={17} /></button>}</section>}
    <div className="grid grid-cols-2 gap-9 pt-[38px] max-[700px]:grid-cols-1 max-[700px]:gap-0.5"><NodeList title="最近计划" plans={plans} topicById={topicById} onOpenPlan={onOpenPlan} /><NodeList title="最近完成" completions={completions} topicById={topicById} onOpenCompletion={onOpenCompletion} /></div>
  </section>
}

function NodeList({ title, plans, completions, topicById, onOpenPlan, onOpenCompletion }: { title: string; plans?: PlanNode[]; completions?: CompletionNode[]; topicById: Map<string, ActionTopic>; onOpenPlan?: (plan: PlanNode) => void; onOpenCompletion?: (completion: CompletionNode) => void }) {
  const isPlans = Boolean(plans)
  return <section><div><span className="section-kicker">项目节点</span><h2 className="mt-[7px] text-[23px] tracking-[-.03em] max-[700px]:text-[21px]">{title}</h2></div><div className="mt-[15px] border-t border-line">{isPlans ? plans?.map((plan) => <button className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 border-b border-line bg-transparent px-0.5 py-3.5 text-left text-ink hover:bg-soft" type="button" onClick={() => onOpenPlan?.(plan)} key={plan.id}><span className="grid size-7 place-items-center rounded-md bg-signal-soft text-signal"><CircleDot size={15} /></span><span className="grid min-w-0 gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{plan.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{topicById.get(plan.topicId)?.title}</small></span><span className="text-[10px] font-bold text-signal">{plan.status === 'active' ? '进行中' : '已完成'}</span></button>) : completions?.map((completion) => <button className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 border-b border-line bg-transparent px-0.5 py-3.5 text-left text-ink hover:bg-soft" type="button" onClick={() => onOpenCompletion?.(completion)} key={completion.id}><span className="grid size-7 place-items-center rounded-md bg-[#edf1f5] text-[#4c6a7b] dark:bg-[#2a353b] dark:text-[#a9c3d0]"><CheckCircle2 size={15} /></span><span className="grid min-w-0 gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{completion.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{topicById.get(completion.topicId)?.title}</small></span><ArrowRight className="text-signal" size={15} /></button>)}{isPlans ? !plans?.length && <p className="py-[25px] text-[13px] text-muted">还没有计划。</p> : !completions?.length && <p className="py-[25px] text-[13px] text-muted">还没有完成记录。</p>}</div></section>
}
