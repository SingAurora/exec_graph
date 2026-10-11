import { useEffect, useState } from 'react'
import type { AIKeyConfig, SaveAIKeyInput } from '../entities/ai-key/model/types'
import { buildPlanMarkdown } from '../features/action/lib/planning'
import type { CreateProjectInput } from '../features/project/model/types'
import { isAppView, isAuthView, useHashRoute } from '../shared/lib/navigation'
import type { ActionTopic, AuthView, CompletionNode, PlanNode, Project, Reaction, UserProfile } from '../shared/model'
import { FeedPage } from '../pages/FeedPage'
import { MyPage } from '../pages/MyPage'
import { ProjectPage } from '../pages/ProjectPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { AuthScreen } from '../widgets/auth/AuthScreen'
import { AppShell } from '../widgets/layout/AppShell'
import { SettingsPanel } from '../widgets/settings/SettingsPanel'
import { AIWorkspace } from '../widgets/ai/AIWorkspace'
import { TopicPage } from '../widgets/topics/TopicPage'

const currentUser: UserProfile = { id: 'jo', name: '乔', email: 'qiao@example.com', gender: 'unknown', bio: '把想法变成正在发生的事情。', avatar: '', activeDays: 12, isTestAccount: true }
const lin: UserProfile = { id: 'lin', name: '林岚', email: 'lin@example.com', gender: 'female', bio: '把手上的事情认真做完。', avatar: '', activeDays: 28 }
const miao: UserProfile = { id: 'miao', name: 'miao', email: 'miao@example.com', gender: 'unknown', bio: '从生活里找到下一步。', avatar: '', activeDays: 9 }

const initialProjects: Project[] = [
  { id: 'daily', ownerId: 'jo', participantIds: ['lin', 'miao'], title: '日常空间整理', description: '让每天使用的空间更容易进入和维持。', createdAt: '2026-09-28T10:00:00+08:00', updatedAt: '2026-10-11T10:20:00+08:00' },
  { id: 'learning', ownerId: 'jo', participantIds: [], title: '阅读与思考', description: '把阅读变成可以回看的理解和行动。', createdAt: '2026-10-01T19:30:00+08:00', updatedAt: '2026-10-11T09:10:00+08:00' },
  { id: 'practice', ownerId: 'lin', participantIds: ['jo'], title: '生活技能练习', description: '通过一次次实际完成积累生活经验。', createdAt: '2026-09-20T08:00:00+08:00', updatedAt: '2026-10-11T07:40:00+08:00' },
]

const initialAIConfigs: AIKeyConfig[] = [
  { id: 'demo-deepseek-flash', provider: 'deepseek', label: 'DeepSeek Flash', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com/v1', keyHint: '**** 25d2', isDefault: true },
]

const initialTopics: ActionTopic[] = [
  { id: 'desk', projectId: 'daily', title: '把书桌整理成明天可以直接开始工作的状态', description: '清理不需要的东西，只留下明天真正会使用的物品。', createdAt: '刚刚' },
  { id: 'balcony', projectId: 'daily', title: '把阳台整理成可以坐下来的地方', description: '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', createdAt: '今天' },
  { id: 'bread', projectId: 'practice', title: '第一次做出完整的酸面包', description: '从准备酵头到烤完出炉，留下完整的一次过程记录。', createdAt: '昨天' },
  { id: 'breakfast', projectId: 'practice', title: '准备一份适合工作日的早餐', description: '用现有食材完成一次简单早餐，并记录实际花费的时间。', createdAt: '今天' },
  { id: 'reading', projectId: 'learning', title: '读完《思考，快与慢》第三章', description: '读完约定的范围，留下一个真正改变自己理解的观点。', createdAt: '今天' },
]

const balconyPlanLin: PlanNode = { id: 'plan-lin-balcony', topicId: 'balcony', authorId: 'lin', title: '把阳台整理成可以坐下来的地方', description: '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', points: ['清理影响使用的杂物', '留出一块可以坐下来的位置', '记录还没有固定收纳的东西'], markdown: buildPlanMarkdown('把阳台整理成可以坐下来的地方', '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', ['清理影响使用的杂物', '留出一块可以坐下来的位置', '记录还没有固定收纳的东西']), status: 'completed', createdAt: '昨天 18:20' }
const balconyPlanMiao: PlanNode = { ...balconyPlanLin, id: 'plan-miao-balcony', authorId: 'miao', description: '先处理每天会经过的动线，再决定哪些东西需要收纳。', points: ['清出从门到椅子的通道', '擦干净可以使用的区域', '记下还需要慢慢处理的物品'], markdown: buildPlanMarkdown('把阳台整理成可以坐下来的地方', '先处理每天会经过的动线，再决定哪些东西需要收纳。', ['清出从门到椅子的通道', '擦干净可以使用的区域', '记下还需要慢慢处理的物品']), status: 'completed', createdAt: '昨天 20:05' }
const readingPlan: PlanNode = { id: 'plan-reading', topicId: 'reading', authorId: 'jo', title: '读完《思考，快与慢》第三章', description: '用半小时读完这一章，记下一个真正改变自己理解的观点。', points: ['完成第三章的阅读', '记下一条自己的理解', '记录读不下去或卡住的地方'], markdown: buildPlanMarkdown('读完《思考，快与慢》第三章', '用半小时读完这一章，记下一个真正改变自己理解的观点。', ['完成第三章的阅读', '记下一条自己的理解', '记录读不下去或卡住的地方']), status: 'active', createdAt: '今天 09:10' }
const deskPlan: PlanNode = { id: 'plan-desk', topicId: 'desk', authorId: 'jo', title: '整理明天要用的书桌', description: '清理不需要的东西，只留下电脑、纸笔和明天要看的书。', points: ['清掉无关物品', '留下明天要用的东西', '记录仍未处理的收纳'], markdown: buildPlanMarkdown('整理明天要用的书桌', '清理不需要的东西，只留下电脑、纸笔和明天要看的书。', ['清掉无关物品', '留下明天要用的东西', '记录仍未处理的收纳']), status: 'completed', createdAt: '今天 08:30' }
const breadPlan: PlanNode = { id: 'plan-bread', topicId: 'bread', authorId: 'lin', title: '第一次做出完整的酸面包', description: '从准备酵头到烤完出炉，完成一次完整过程。', points: ['准备酵头', '记录发酵过程', '完成烘烤'], markdown: buildPlanMarkdown('第一次做出完整的酸面包', '从准备酵头到烤完出炉，完成一次完整过程。', ['准备酵头', '记录发酵过程', '完成烘烤']), status: 'completed', createdAt: '昨天 08:10' }
const breakfastPlan: PlanNode = { id: 'plan-breakfast', topicId: 'breakfast', authorId: 'jo', title: '准备一份适合工作日的早餐', description: '明早用现有食材做一份简单早餐，确认从开始到收拾完需要多久。', points: ['只使用家里现有的食材', '记录准备和收拾的时间', '留下下一次可以改进的地方'], markdown: buildPlanMarkdown('准备一份适合工作日的早餐', '明早用现有食材做一份简单早餐，确认从开始到收拾完需要多久。', ['只使用家里现有的食材', '记录准备和收拾的时间', '留下下一次可以改进的地方']), status: 'active', createdAt: '今天 07:40' }

const initialPlans: PlanNode[] = [readingPlan, breakfastPlan, deskPlan, balconyPlanLin, balconyPlanMiao, breadPlan]
const initialCompletions: CompletionNode[] = [
  { id: 'completion-desk', topicId: 'desk', planNodeId: deskPlan.id, authorId: 'jo', title: '整理明天要用的书桌：完成记录', markdown: '# 整理明天要用的书桌：完成记录\n\n## 这次实际发生\n\n清掉了桌上的杯子和纸张，只留下电脑和明天要看的书。\n\n## 这次留下的观察\n\n抽屉还没有整理，但桌面已经可以直接开始工作。', believeCount: 6, doubtCount: 0, createdAt: '今天 08:55' },
  { id: 'completion-lin-balcony', topicId: 'balcony', planNodeId: balconyPlanLin.id, authorId: 'lin', title: '把阳台整理成可以坐下来的地方：完成记录', markdown: '# 把阳台整理成可以坐下来的地方：完成记录\n\n## 原计划\n\n不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。\n\n## 这次实际发生\n\n清掉了地上的箱子和不用的纸袋，擦干净了地面，留下了一把椅子和一盏灯。\n\n## 这次留下的观察\n\n晚上终于愿意坐在那里了，但旧物还没有固定收纳。', believeCount: 18, doubtCount: 3, createdAt: '今天 09:20' },
  { id: 'completion-miao-balcony', topicId: 'balcony', planNodeId: balconyPlanMiao.id, authorId: 'miao', title: '把阳台整理成可以坐下来的地方：完成记录', markdown: '# 把阳台整理成可以坐下来的地方：完成记录\n\n## 原计划\n\n先处理每天会经过的动线，再决定哪些东西需要收纳。\n\n## 这次实际发生\n\n先清出了从门到椅子的通道，擦干了可以使用的区域。旧花盆还没有处理，但晚上已经可以坐下来。\n\n## 这次留下的观察\n\n先让空间恢复使用，比一次整理完所有东西更容易开始。', believeCount: 12, doubtCount: 1, createdAt: '昨天 21:08' },
  { id: 'completion-lin-bread', topicId: 'bread', planNodeId: 'plan-bread', authorId: 'lin', title: '第一次做出完整的酸面包：完成记录', markdown: '# 第一次做出完整的酸面包：完成记录\n\n## 这次实际发生\n\n从准备酵头到烤完出炉，第一次把整个过程做完了。\n\n## 这次留下的观察\n\n下次想把发酵时间记得更准确。', believeCount: 9, doubtCount: 0, createdAt: '昨天 09:20' },
]

export function App() {
  const [route, navigate] = useHashRoute('my', isAppView)
  const authRoute = useAuthRoute()
  const [profile, setProfile] = useState(currentUser)
  const [projects, setProjects] = useState(initialProjects)
  const [topics, setTopics] = useState(initialTopics)
  const [plans, setPlans] = useState(initialPlans)
  const [completions, setCompletions] = useState(initialCompletions)
  const [aiConfigs, setAIConfigs] = useState<AIKeyConfig[]>(initialAIConfigs)
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})
  const followingIds = ['lin']
  const [darkMode, setDarkMode] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState('balcony')
  const [selectedProjectId, setSelectedProjectId] = useState('daily')
  const [projectBackView, setProjectBackView] = useState<'my' | 'projects'>('my')
  const [workspaceMode, setWorkspaceMode] = useState<'planning' | 'completion'>('planning')
  const [workspacePlan, setWorkspacePlan] = useState<PlanNode | undefined>()
  const [workspaceCompletion, setWorkspaceCompletion] = useState<CompletionNode | undefined>()
  const [workspaceTopicId, setWorkspaceTopicId] = useState<string | undefined>()
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | undefined>()

  useEffect(() => { if (darkMode) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme') }, [darkMode])
  useEffect(() => { window.scrollTo(0, 0) }, [route, authRoute])

  if (authRoute) return <AuthScreen view={authRoute} onEnter={() => navigate('my')} />

  const openTopic = (topicId: string) => { setSelectedTopicId(topicId); navigate('topic') }
  const openProject = (projectId: string, backView?: 'my' | 'projects') => { setSelectedProjectId(projectId); if (backView) setProjectBackView(backView); navigate('project') }
  const startPlanning = (topicId?: string, projectId?: string) => { const topic = topics.find((item) => item.id === topicId); setWorkspaceMode('planning'); setWorkspacePlan(undefined); setWorkspaceCompletion(undefined); setWorkspaceTopicId(topicId); setWorkspaceProjectId(projectId ?? topic?.projectId ?? projects[0].id); navigate('publish') }
  const openPlanInteraction = (plan: PlanNode) => { const topic = topics.find((item) => item.id === plan.topicId); setWorkspaceMode('planning'); setWorkspacePlan(plan); setWorkspaceCompletion(undefined); setWorkspaceTopicId(plan.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const startCompletion = (plan: PlanNode) => { const topic = topics.find((item) => item.id === plan.topicId); setWorkspaceMode('completion'); setWorkspacePlan(plan); setWorkspaceCompletion(completions.find((item) => item.planNodeId === plan.id)); setWorkspaceTopicId(plan.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const openCompletionInteraction = (completion: CompletionNode) => { const plan = plans.find((item) => item.id === completion.planNodeId); const topic = topics.find((item) => item.id === completion.topicId); if (!plan) return; setWorkspaceMode('completion'); setWorkspacePlan(plan); setWorkspaceCompletion(completion); setWorkspaceTopicId(completion.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const createProject = (input: CreateProjectInput) => { const id = `project-${Date.now()}`; const now = new Date().toISOString(); const project: Project = { id, ownerId: profile.id, participantIds: [], title: input.title, description: input.description || '暂无项目说明', createdAt: now, updatedAt: now }; setProjects((current) => [project, ...current]); setSelectedProjectId(id); setProjectBackView('projects'); navigate('project') }
  const saveAIConfig = (input: SaveAIKeyInput) => setAIConfigs((current) => [...current, { ...input, id: `ai-key-${Date.now()}`, isDefault: current.length === 0 }])
  const setDefaultAIConfig = (id: string) => setAIConfigs((current) => current.map((config) => ({ ...config, isDefault: config.id === id })))
  const deleteAIConfig = (id: string) => setAIConfigs((current) => { const remaining = current.filter((config) => config.id !== id); if (remaining.length && !remaining.some((config) => config.isDefault)) remaining[0] = { ...remaining[0], isDefault: true }; return remaining })

  const confirmWorkspace = (markdown: string, details: { title: string; description: string; points: string[]; note: string }) => {
    if (workspaceMode === 'planning') {
      if (workspacePlan) {
        setPlans((current) => current.map((plan) => plan.id === workspacePlan.id ? { ...plan, title: details.title, description: details.description, points: details.points, markdown } : plan))
        if (workspaceProjectId) openProject(workspaceProjectId); else navigate('my')
        return
      }
      const topicId = workspaceTopicId ?? `topic-${Date.now()}`
      const projectId = workspaceProjectId ?? projects[0].id
      if (!workspaceTopicId) setTopics((current) => [{ id: topicId, projectId, title: details.title, description: details.description, createdAt: '刚刚' }, ...current])
      const plan: PlanNode = { id: `plan-${Date.now()}`, topicId, authorId: profile.id, title: details.title, description: details.description, points: details.points, markdown, status: 'active', createdAt: '刚刚' }
      setPlans((current) => [plan, ...current])
      setSelectedProjectId(projectId)
      navigate('project')
      return
    }
    if (!workspacePlan) return
    if (workspaceCompletion) {
      setCompletions((current) => current.map((completion) => completion.id === workspaceCompletion.id ? { ...completion, markdown, createdAt: '刚刚更新' } : completion))
      if (workspaceProjectId) openProject(workspaceProjectId); else navigate('my')
      return
    }
    const completion: CompletionNode = { id: `completion-${Date.now()}`, topicId: workspacePlan.topicId, planNodeId: workspacePlan.id, authorId: profile.id, title: `${workspacePlan.title}：完成记录`, markdown, believeCount: 0, doubtCount: 0, createdAt: '刚刚' }
    setCompletions((current) => [completion, ...current])
    setPlans((current) => current.map((plan) => plan.id === workspacePlan.id ? { ...plan, status: 'completed' } : plan))
    if (workspaceProjectId) openProject(workspaceProjectId); else navigate('my')
  }

  const onReaction = (id: string, next: Exclude<Reaction, null>) => {
    const previous = reactions[id] ?? null
    if (previous === next) {
      setReactions((current) => ({ ...current, [id]: null }))
      setCompletions((current) => current.map((completion) => completion.id === id ? { ...completion, believeCount: next === 'believe' ? Math.max(0, completion.believeCount - 1) : completion.believeCount, doubtCount: next === 'doubt' ? Math.max(0, completion.doubtCount - 1) : completion.doubtCount } : completion))
      return
    }
    setReactions((current) => ({ ...current, [id]: next }))
    setCompletions((current) => current.map((completion) => {
      if (completion.id !== id) return completion
      return { ...completion, believeCount: completion.believeCount + (next === 'believe' ? 1 : 0) - (previous === 'believe' ? 1 : 0), doubtCount: completion.doubtCount + (next === 'doubt' ? 1 : 0) - (previous === 'doubt' ? 1 : 0) }
    }))
  }

  const visibleCompletions = route === 'following' ? completions.filter((completion) => followingIds.includes(completion.authorId)) : completions
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0]
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const selectedProjectTopics = topics.filter((topic) => topic.projectId === selectedProject.id)
  const selectedProjectTopicIds = new Set(selectedProjectTopics.map((topic) => topic.id))
  const selectedProjectPlans = plans.filter((plan) => selectedProjectTopicIds.has(plan.topicId))
  const selectedProjectCompletions = completions.filter((completion) => selectedProjectTopicIds.has(completion.topicId))
  const allUsers = [profile, lin, miao]
  const ownPlans = plans.filter((plan) => plan.authorId === profile.id)
  const ownCompletions = completions.filter((completion) => completion.authorId === profile.id)
  const activeAIConfig = aiConfigs.find((config) => config.isDefault) ?? aiConfigs[0]

  return <AppShell profile={profile} profileStats={{ createdProjects: projects.filter((project) => project.ownerId === profile.id).length, completedRecords: ownCompletions.length }} activeView={route} darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} onLogout={() => { window.location.hash = 'login' }}>
    {route === 'home' && <FeedPage title="公开完成记录" eyebrow="大家最近完成的事情" completions={visibleCompletions} topics={topics} plans={plans} users={allUsers} reactions={reactions} onReaction={onReaction} onOpenTopic={openTopic} onParallel={startPlanning} />}
    {route === 'following' && <FeedPage title="最新完成记录" eyebrow="来自你关注的人" completions={visibleCompletions} topics={topics} plans={plans} users={allUsers} reactions={reactions} onReaction={onReaction} onOpenTopic={openTopic} onParallel={startPlanning} />}
    {route === 'publish' && <AIWorkspace key={`${workspaceMode}-${workspacePlan?.id ?? 'new'}-${workspaceCompletion?.id ?? 'new'}`} mode={workspaceMode} profileName={profile.name} aiConfig={activeAIConfig} plan={workspacePlan} topicTitle={workspaceTopicId ? topics.find((topic) => topic.id === workspaceTopicId)?.title : undefined} initialDocument={workspaceMode === 'planning' ? workspacePlan?.markdown : workspaceCompletion?.markdown} onStartCompletion={workspaceMode === 'planning' && workspacePlan?.status === 'active' ? () => startCompletion(workspacePlan) : undefined} onBack={() => workspaceProjectId ? openProject(workspaceProjectId) : navigate('my')} onConfirm={confirmWorkspace} />}
    {route === 'my' && <MyPage profile={profile} projects={projects} plans={ownPlans} completions={ownCompletions} topics={topics} onOpenProject={(projectId) => openProject(projectId, 'my')} onOpenPlan={(plan) => { setProjectBackView('my'); openPlanInteraction(plan) }} onOpenCompletion={(completion) => { setProjectBackView('my'); openCompletionInteraction(completion) }} />}
    {route === 'project' && <ProjectPage project={selectedProject} currentUserId={profile.id} topics={selectedProjectTopics} plans={selectedProjectPlans.filter((plan) => plan.authorId === profile.id)} completions={selectedProjectCompletions.filter((completion) => completion.authorId === profile.id)} backLabel={projectBackView === 'projects' ? '回到所有项目' : '回到我的'} onBack={() => navigate(projectBackView)} onCreatePlan={(projectId) => startPlanning(undefined, projectId)} onOpenPlan={openPlanInteraction} onOpenCompletion={openCompletionInteraction} />}
    {route === 'projects' && <ProjectsPage currentUserId={profile.id} projects={projects} topics={topics} plans={plans} completions={completions} onBack={() => navigate('my')} onCreateProject={createProject} onOpenProject={(projectId) => openProject(projectId, 'projects')} />}
    {route === 'topic' && <TopicPage topic={selectedTopic} plans={plans.filter((plan) => plan.topicId === selectedTopic.id)} completions={completions.filter((completion) => completion.topicId === selectedTopic.id)} users={allUsers} reactions={reactions} onBack={() => navigate('home')} onReaction={onReaction} onParallel={startPlanning} />}
    {route === 'settings' && <SettingsPanel profile={profile} darkMode={darkMode} aiConfigs={aiConfigs} onSave={setProfile} onToggleTheme={() => setDarkMode((current) => !current)} onSaveAIConfig={saveAIConfig} onSetDefaultAIConfig={setDefaultAIConfig} onDeleteAIConfig={deleteAIConfig} />}
  </AppShell>
}

function useAuthRoute() {
  const [route, setRoute] = useState<AuthView | null>(() => { const value = window.location.hash.slice(1); return isAuthView(value) ? value : null })
  useEffect(() => { const handleHashChange = () => { const value = window.location.hash.slice(1); setRoute(isAuthView(value) ? value : null) }; window.addEventListener('hashchange', handleHashChange); return () => window.removeEventListener('hashchange', handleHashChange) }, [])
  return route
}
