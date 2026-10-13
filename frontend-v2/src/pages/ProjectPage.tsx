import { ArrowLeft, ArrowRight, CheckCircle2, CircleDot, FileText, GitBranch, MessageCircle, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildBranchSummaries, getBranchPath, getPlanBranchId } from '../features/action/lib/branches'
import type { ArchiveTab, BranchMode, CompletionNode, PlanNode, Project, UserProfile } from '../shared/model'
import { MarkdownDocument } from '../widgets/ai/MarkdownDocument'
import { Avatar } from '../widgets/layout/AppShell'
import { PostImageGallery } from '../widgets/post/PostImageGallery'

type ProjectPageProps = {
  project: Project
  currentUserId: string
  users: UserProfile[]
  plans: PlanNode[]
  completions: CompletionNode[]
  backLabel: string
  onBack: () => void
  onCreatePlan: (projectId: string) => void
  onContinuePlan: (plan: PlanNode, branchMode: BranchMode) => void
  onOpenArchive: (plan: PlanNode, tab: ArchiveTab) => void
  onOpenPlan: (plan: PlanNode) => void
  onOpenCompletion: (completion: CompletionNode) => void
}

type DetailMode = 'summary' | 'detail'

const FLOOR_BATCH_SIZE = 8

export function ProjectPage({ project, currentUserId, users, plans, completions, backLabel, onBack, onCreatePlan, onContinuePlan, onOpenArchive, onOpenPlan, onOpenCompletion }: ProjectPageProps) {
  const completionByPlanId = new Map(completions.map((completion) => [completion.planNodeId, completion]))
  const userById = new Map(users.map((user) => [user.id, user]))
  const branches = useMemo(() => buildBranchSummaries(plans, completions), [plans, completions])
  const mainBranch = branches.find((branch) => branch.isMain) ?? branches[0]
  const [contextBranchId, setContextBranchId] = useState(mainBranch?.id)
  const [selectedPlanId, setSelectedPlanId] = useState(getBranchPath(mainBranch?.id ?? '', plans).at(-1)?.id)
  const [detailMode, setDetailMode] = useState<DetailMode>('summary')
  const [visibleFloorCount, setVisibleFloorCount] = useState(FLOOR_BATCH_SIZE)
  const floorLoadMoreRef = useRef<HTMLDivElement>(null)

  const activeBranch = branches.find((branch) => branch.id === contextBranchId) ?? mainBranch
  const contextPlans = activeBranch ? getBranchPath(activeBranch.id, plans) : plans
  const latestContextPlan = contextPlans[contextPlans.length - 1]
  const visibleContextPlans = contextPlans.filter((plan) => completionByPlanId.has(plan.id) || plan.id === latestContextPlan?.id).reverse()
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? contextPlans[contextPlans.length - 1]
  const selectedCompletion = selectedPlan ? completionByPlanId.get(selectedPlan.id) : undefined
  const selectedIndex = selectedPlan ? contextPlans.findIndex((plan) => plan.id === selectedPlan.id) : -1
  const isMainContext = activeBranch?.isMain ?? true
  const selectedVisibleIndex = selectedPlan ? visibleContextPlans.findIndex((plan) => plan.id === selectedPlan.id) : -1
  const renderedFloorCount = Math.max(visibleFloorCount, selectedVisibleIndex + 1)
  const renderedContextPlans = visibleContextPlans.slice(0, renderedFloorCount)

  useEffect(() => {
    if (!mainBranch) return
    if (!contextBranchId || !branches.some((branch) => branch.id === contextBranchId)) setContextBranchId(mainBranch.id)
    const latestPlan = getBranchPath(mainBranch.id, plans).at(-1)
    if ((!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) && latestPlan) setSelectedPlanId(latestPlan.id)
  }, [branches, contextBranchId, mainBranch, plans, selectedPlanId])

  useEffect(() => {
    setVisibleFloorCount(FLOOR_BATCH_SIZE)
  }, [contextBranchId, visibleContextPlans.length])

  useEffect(() => {
    const loadMoreTarget = floorLoadMoreRef.current
    if (!loadMoreTarget || renderedFloorCount >= visibleContextPlans.length) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisibleFloorCount((current) => Math.min(current + FLOOR_BATCH_SIZE, visibleContextPlans.length))
    }, { rootMargin: '420px 0px' })
    observer.observe(loadMoreTarget)
    return () => observer.disconnect()
  }, [renderedFloorCount, visibleContextPlans.length])

  const selectPlan = (plan: PlanNode) => {
    setSelectedPlanId(plan.id)
    setDetailMode('summary')
  }

  const openBranch = (branchId: string) => {
    const path = getBranchPath(branchId, plans)
    setContextBranchId(branchId)
    setSelectedPlanId(path[path.length - 1]?.id)
    setDetailMode('summary')
  }

  const returnToMain = () => {
    if (!mainBranch) return
    const path = getBranchPath(mainBranch.id, plans)
    setContextBranchId(mainBranch.id)
    setSelectedPlanId(path[path.length - 1]?.id)
    setDetailMode('summary')
  }

  const directBranches = selectedPlan
    ? branches.filter((branch) => branch.id !== getPlanBranchId(selectedPlan) && branch.plans.some((plan) => plan.parentPlanId === selectedPlan.id))
    : []

  return <section className="max-w-[1000px] pt-[38px] max-[700px]:pt-7">
    <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-muted hover:text-signal" type="button" onClick={onBack}><ArrowLeft size={16} />{backLabel}</button>
    <header className="flex items-end justify-between gap-6 border-b border-line py-7 pb-[25px] max-[700px]:items-stretch max-[700px]:flex-col"><div><span className="section-kicker">{project.ownerId === currentUserId ? '我创建的项目' : '我参与的项目'}</span><h2 className="mt-[7px] text-[27px] tracking-[-.04em]">{project.title}</h2><p className="mt-2 max-w-[610px] text-[13px] leading-[1.7] text-muted">{project.description}</p></div><button className="primary-button max-[700px]:w-full" type="button" onClick={() => onCreatePlan(project.id)}><Plus size={16} />创建计划</button></header>
    {!plans.length ? <EmptyProject onCreatePlan={() => onCreatePlan(project.id)} /> : <div className="mt-[30px] grid grid-cols-[minmax(260px,.78fr)_minmax(0,1.35fr)] items-start border border-line bg-surface max-[900px]:grid-cols-[minmax(220px,.72fr)_minmax(0,1.28fr)] max-[700px]:mt-5 max-[700px]:block">
      <aside className="min-w-0 border-r border-line max-[700px]:border-r-0 max-[700px]:border-b" aria-label="项目楼层导航">
        <div className="border-b border-line px-4 py-[17px]"><div className="flex items-start justify-between gap-3"><div><span className="section-kicker">项目楼</span><h3 className="mt-1 text-[17px]">{isMainContext ? '主楼' : '当前支链'}</h3></div><span className="inline-flex items-center gap-1 text-[10px] font-bold text-signal"><GitBranch size={13} />{contextPlans.length} 楼</span></div>{!isMainContext && <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-muted">从主楼第 {getSharedFloorNumber(contextPlans, mainBranch ? getBranchPath(mainBranch.id, plans) : plans)} 楼分出</span><button className="border-0 bg-transparent p-0 text-[10px] font-bold text-signal hover:text-signal-dark" type="button" onClick={returnToMain}>回到主楼</button></div>}{isMainContext && <p className="mt-2 text-[10px] leading-[1.6] text-muted">默认阅读项目当前的执行主线。支链会在对应楼层留下入口。</p>}</div>
        <div aria-label={isMainContext ? '主楼列表' : '当前支链列表'}>{renderedContextPlans.map((plan) => <FloorSummary key={plan.id} floorNumber={contextPlans.findIndex((item) => item.id === plan.id) + 1} plan={plan} author={userById.get(plan.authorId)} completion={completionByPlanId.get(plan.id)} selected={plan.id === selectedPlan?.id} isMain={isMainContext || getPlanBranchId(plan) !== activeBranch?.id} onSelect={() => selectPlan(plan)} />)}{renderedFloorCount < visibleContextPlans.length && <div ref={floorLoadMoreRef} className="px-4 py-4 text-center text-[11px] text-muted" aria-live="polite">继续加载更早楼层…</div>}</div>
      </aside>
      <main className="min-w-0" aria-label="选中楼层详情">{selectedPlan ? <PostDetail plan={selectedPlan} completion={selectedCompletion} floorNumber={selectedIndex + 1} isMain={isMainContext || getPlanBranchId(selectedPlan) !== activeBranch?.id} detailMode={detailMode} directBranches={directBranches} onChangeMode={setDetailMode} onOpenArchive={onOpenArchive} onOpenPlan={onOpenPlan} onOpenCompletion={onOpenCompletion} onContinue={() => onContinuePlan(selectedPlan, 'continue')} onFork={() => onContinuePlan(selectedPlan, 'fork')} onOpenBranch={openBranch} /> : <p className="p-6 text-[13px] text-muted">选择左侧楼层查看内容。</p>}</main>
    </div>}
  </section>
}

function FloorSummary({ floorNumber, plan, author, completion, selected, isMain, onSelect }: { floorNumber: number; plan: PlanNode; author?: UserProfile; completion?: CompletionNode; selected: boolean; isMain: boolean; onSelect: () => void }) {
  const completionSummary = completion ? readMarkdownSection(completion.markdown, '这次实际发生') || completion.markdown : '完成记录等待补充。'
  return <button className={`relative block w-full border-0 border-b border-line bg-transparent px-4 py-[15px] text-left transition hover:bg-soft ${selected ? 'bg-signal-soft' : ''}`} type="button" onClick={onSelect}><span className={`absolute inset-y-0 left-0 w-0.5 ${selected ? 'bg-signal' : 'bg-transparent'}`} /><div className="flex items-center justify-between gap-2"><span className="font-sans text-[10px] font-bold text-signal">第 {floorNumber} 楼</span>{completion ? isMain ? <span className="text-[10px] font-bold text-signal">主楼</span> : <span className="text-[10px] font-bold text-muted">支链</span> : <span className="text-[10px] font-bold text-coral">仅有计划</span>}</div><strong className="mt-[7px] block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-ink">{plan.title}</strong><span className="mt-[7px] flex items-center gap-2 text-[10px] text-muted"><Avatar profile={author} label={plan.authorId.slice(0, 1).toUpperCase()} size="tiny" /><span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{author?.name ?? plan.authorId}</span></span><span className={`post-summary-clamp mt-[9px] text-[11px] leading-[1.55] ${completion ? 'text-muted' : 'text-coral'}`}>{completionSummary}</span>{completion?.images?.length ? <div className="mt-3 flex gap-1.5" aria-label="楼层图片缩略图">{completion.images.slice(0, 3).map((image) => <img className="size-11 rounded border border-line object-cover" key={image.url} src={image.url} alt={image.alt} loading="lazy" />)}</div> : null}</button>
}

function PostDetail({ plan, completion, floorNumber, isMain, detailMode, directBranches, onChangeMode, onOpenArchive, onOpenPlan, onOpenCompletion, onContinue, onFork, onOpenBranch }: { plan: PlanNode; completion?: CompletionNode; floorNumber: number; isMain: boolean; detailMode: DetailMode; directBranches: ReturnType<typeof buildBranchSummaries>; onChangeMode: (mode: DetailMode) => void; onOpenArchive: (plan: PlanNode, tab: ArchiveTab) => void; onOpenPlan: (plan: PlanNode) => void; onOpenCompletion: (completion: CompletionNode) => void; onContinue: () => void; onFork: () => void; onOpenBranch: (branchId: string) => void }) {
  const completionSummary = completion ? readMarkdownSection(completion.markdown, '这次实际发生') || completion.markdown : ''
  return <article><header className="border-b border-line px-6 py-[19px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><span className="section-kicker">{isMain ? '主楼帖子' : '支链帖子'}</span><span className="font-sans text-[10px] font-bold text-muted">第 {floorNumber} 楼 · {completion ? '已完成' : '等待完成'}</span></div><h3 className="mt-[7px] text-[23px] tracking-[-.03em] max-[700px]:text-[20px]">{plan.title}</h3><div className="mt-[9px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted"><span>{plan.authorId}</span><span>·</span><span className="font-bold text-signal">{completion ? '完成记录' : '尚未完成'}</span></div><div className="mt-[15px] flex items-center justify-between gap-3"><div className="inline-flex rounded-md border border-line bg-paper p-0.5" role="tablist" aria-label="完成记录显示方式"><button className={`rounded px-2.5 py-1.5 text-[11px] font-bold ${detailMode === 'summary' ? 'bg-signal text-white' : 'text-muted'}`} type="button" role="tab" aria-selected={detailMode === 'summary'} onClick={() => onChangeMode('summary')}>摘要</button><button className={`rounded px-2.5 py-1.5 text-[11px] font-bold ${detailMode === 'detail' ? 'bg-signal text-white' : 'text-muted'}`} type="button" role="tab" aria-selected={detailMode === 'detail'} onClick={() => onChangeMode('detail')}>详情</button></div><span className="text-[10px] text-muted">{completion ? '完成帖接续主楼内容' : '计划帖等待完成记录'}</span></div></header>{detailMode === 'summary' ? <CompletionBody completion={completion} completionSummary={completionSummary} /> : <DetailBody completion={completion} />}<div className="border-t border-line px-6 py-[15px] max-[700px]:px-4"><div className="flex flex-wrap items-center gap-2.5"><button className="primary-button min-h-[34px] px-3 py-2 text-xs" type="button" onClick={onContinue}><ArrowRight size={14} />沿此继续</button><button className="quiet-button" type="button" onClick={onFork}><GitBranch size={14} />另开方案</button><button className="quiet-button" type="button" onClick={() => onOpenArchive(plan, 'plan')}><FileText size={14} />查看计划</button><button className="quiet-button" type="button" onClick={() => onOpenArchive(plan, 'history')}><MessageCircle size={14} />查看 AI 对话</button>{!completion && <button className="quiet-button" type="button" onClick={() => onOpenPlan(plan)}><FileText size={14} />继续制定</button>}{completion && <button className="quiet-button" type="button" onClick={() => onOpenCompletion(completion)}><CheckCircle2 size={14} />继续记录</button>}</div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted"><span className="inline-flex items-center gap-1"><MessageCircle size={13} />楼内讨论暂未开放</span><span>完成记录是公开内容，计划和对话可在楼层资料中查看。</span></div></div>{directBranches.length > 0 && <section className="border-t border-line px-6 py-[18px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><div><span className="section-kicker">从这一楼分出</span><h4 className="mt-1 text-[17px]">其他执行方案</h4></div><span className="text-[10px] text-muted">{directBranches.length} 条支链</span></div><div className="mt-3 grid gap-2">{directBranches.map((branch) => <button className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-0 border-b border-line bg-transparent px-0 py-3 text-left hover:text-signal" type="button" key={branch.id} onClick={() => onOpenBranch(branch.id)}><span className="grid gap-1"><strong className="text-xs">{branch.title}</strong><small className="text-[10px] text-muted">{branch.completedCount} 条完成 · {branch.continuationCount} 次接续 · 查看支链主楼</small></span><ArrowRight size={15} className="text-signal" /></button>)}</div></section>}</article>
}

function CompletionBody({ completion, completionSummary }: { completion?: CompletionNode; completionSummary: string }) {
  return <div className="border-b border-line"><SummaryPost label="完成记录" status={completion ? '已完成' : '待补充'} title={completion ? '实际发生了什么' : '完成记录还没有补充'} body={completion ? completionSummary : '这楼已经发布计划。完成后，记录会补充到这里。'} muted={!completion}>{completion && <><PostImageGallery images={completion.images} /><div className="mt-4 border-t border-line pt-4"><span className="section-kicker">后续观察</span><p className="mt-2 text-[13px] leading-[1.75] text-ink">{readMarkdownSection(completion.markdown, '这次留下的观察') || '暂无新的观察。'}</p></div></>}</SummaryPost></div>
}

function SummaryPost({ label, status, title, body, muted = false, children }: { label: string; status: string; title: string; body: string; muted?: boolean; children?: ReactNode }) {
  return <section className="px-6 py-6 max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><span className="section-kicker">{label}</span><span className={`text-[10px] font-bold ${muted ? 'text-muted' : 'text-signal'}`}>{status}</span></div><h4 className="mt-2 text-[17px]">{title}</h4><p className={`mt-2 text-[13px] leading-[1.75] ${muted ? 'text-muted' : 'text-ink'}`}>{body || '暂无内容。'}</p>{children}</section>
}

function DetailBody({ completion }: { completion?: CompletionNode }) {
  return <div className="border-b border-line px-6 py-5 max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><span className="section-kicker">完成记录 · 详细内容</span><span className={`text-[10px] font-bold ${completion ? 'text-signal' : 'text-muted'}`}>{completion ? 'AI 完成文档' : '等待完成记录'}</span></div><div className="mt-3 border border-line bg-paper"><MarkdownDocument markdown={completion?.markdown ?? ''} label="完成 Markdown" empty="完成记录会在同一楼的完成帖中生成。" /></div></div>
}

function EmptyProject({ onCreatePlan }: { onCreatePlan: () => void }) {
  return <div className="mt-[30px] border-y border-line py-14 text-center"><CircleDot size={24} className="mx-auto text-signal" /><h3 className="mt-3 text-[17px]">项目还没有楼层</h3><p className="mt-2 text-[13px] text-muted">先制定第一楼计划，项目会从这里开始盖起来。</p><button className="primary-button mt-5" type="button" onClick={onCreatePlan}><Plus size={15} />创建第一楼</button></div>
}

function readMarkdownSection(markdown: string, heading: string) {
  const marker = `## ${heading}`
  const start = markdown.indexOf(marker)
  if (start < 0) return ''
  const contentStart = start + marker.length
  const nextHeading = markdown.indexOf('\n## ', contentStart)
  return markdown.slice(contentStart, nextHeading < 0 ? undefined : nextHeading).trim()
}

function getSharedFloorNumber(path: PlanNode[], mainPath: PlanNode[]) {
  const mainPlanIds = new Set(mainPath.map((plan) => plan.id))
  const firstBranchPlan = path.find((plan) => !mainPlanIds.has(plan.id))
  const parentIndex = firstBranchPlan?.parentPlanId ? mainPath.findIndex((plan) => plan.id === firstBranchPlan.parentPlanId) : -1
  return parentIndex >= 0 ? parentIndex + 1 : 1
}
