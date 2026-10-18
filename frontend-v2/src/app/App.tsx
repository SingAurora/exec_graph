import { useEffect, useState } from 'react'
import { demoActions } from './demo/actions'
import type { ActionNode } from '../entities/action/model/types'
import { getActionContextIds } from '../entities/action/lib/graph'
import { getActionExpression } from '../entities/action/lib/expressions'
import type { AIKeyConfig, SaveAIKeyInput } from '../entities/ai-key/model/types'
import { buildPlanMarkdown } from '../features/action/lib/planning'
import { getPlanBranchId, getPlanBranchTitle } from '../features/action/lib/branches'
import type { CreateProjectInput } from '../features/project/model/types'
import { isAppView, isAuthView, useHashRoute } from '../shared/lib/navigation'
import type { ActionTopic, AuthView, BranchMode, ChatMessage, CompletionNode, PlanNode, Project, Reaction, UserProfile } from '../shared/model'
import { FeedPage } from '../pages/FeedPage'
import { MyPage } from '../pages/MyPage'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
import { ProfilePage } from '../pages/ProfilePage'
import { ProjectPage } from '../pages/ProjectPage'
import { cookingContextGuide } from './demo/cooking'
import { cookingParticipants } from './demo/cooking/participants'
import { ProjectsPage } from '../pages/ProjectsPage'
import { AuthScreen } from '../widgets/auth/AuthScreen'
import { AppShell } from '../widgets/layout/AppShell'
import { SettingsPanel } from '../widgets/settings/SettingsPanel'
import { AIWorkspace } from '../widgets/ai/AIWorkspace'
import { ActionWorkspace } from '../widgets/ai/ActionWorkspace'
import { TopicPage } from '../widgets/topics/TopicPage'
import { ActionArchivePage } from '../pages/ActionArchivePage'
import cookingGraphAvatar from '../../assets/cooking-graph-avatar.jpg'
import cookingGraphBackground from '../../assets/cooking-graph-background.jpg'

const currentUser: UserProfile = { id: 'jo', name: '乔', email: 'qiao@example.com', gender: 'unknown', bio: '把想法变成正在发生的事情。', avatar: '', activeDays: 12, isTestAccount: true }
const legendPreferenceKey = 'execg.actionGraph.showLegend'
const lin: UserProfile = { id: 'lin', name: '林岚', email: 'lin@example.com', gender: 'female', bio: '把手上的事情认真做完。', avatar: '', activeDays: 28 }
const miao: UserProfile = { id: 'miao', name: 'miao', email: 'miao@example.com', gender: 'unknown', bio: '从生活里找到下一步。', avatar: '', activeDays: 9 }

const initialProjects: Project[] = [
  { id: 'cooking', ownerId: 'jo', participantIds: ['lin', 'miao', ...cookingParticipants.map((user) => user.id)], title: '一盘番茄炒蛋：练出可复现的好吃', description: '从番茄和鸡蛋出发，各自在真实晚餐里练习、复做和借用彼此的经验，留下做法的变化与不同的口味取舍。', avatar: cookingGraphAvatar, backgroundImage: cookingGraphBackground, contextGuide: cookingContextGuide, createdAt: '2026-10-03T19:30:00+08:00', updatedAt: '2026-10-16T19:20:00+08:00' },
  { id: 'daily', ownerId: 'jo', participantIds: ['lin', 'miao'], title: '日常空间整理', description: '让每天使用的空间更容易进入和维持。', createdAt: '2026-09-28T10:00:00+08:00', updatedAt: '2026-10-11T10:20:00+08:00' },
  { id: 'learning', ownerId: 'jo', participantIds: [], title: '阅读与思考', description: '把阅读变成可以回看的理解和行动。', createdAt: '2026-10-01T19:30:00+08:00', updatedAt: '2026-10-11T09:10:00+08:00' },
  { id: 'practice', ownerId: 'lin', participantIds: ['jo'], title: '生活技能练习', description: '通过一次次实际完成积累生活经验。', createdAt: '2026-09-20T08:00:00+08:00', updatedAt: '2026-10-11T07:40:00+08:00' },
]

const initialAIConfigs: AIKeyConfig[] = [
  { id: 'demo-deepseek-flash', provider: 'deepseek', label: 'DeepSeek Flash', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com/v1', keyHint: '**** 25d2', isDefault: true },
]

const initialTopics: ActionTopic[] = [
  { id: 'cook-base', projectId: 'cooking', title: '用同一组食材完成番茄炒蛋基础版', description: '先固定食材和标准，记录每个人的原始结果。', createdAt: '10/08' },
  { id: 'cook-heat', projectId: 'cooking', title: '只调整鸡蛋火候，找到稳定口感', description: '把变量缩小到火候，比较鸡蛋从嫩到老的差异。', createdAt: '10/09' },
  { id: 'cook-order', projectId: 'cooking', title: '只调整番茄处理和下锅顺序', description: '观察番茄出汁、酸度和鸡蛋口感如何相互影响。', createdAt: '10/10' },
  { id: 'cook-repeat', projectId: 'cooking', title: '在工作日晚餐、20 分钟和一口锅限制下复做番茄炒蛋', description: '让方法进入真实工作日晚餐，而不是只在从容时成立。', createdAt: '10/11' },
  { id: 'cook-principles', projectId: 'cooking', title: '整理出自己的番茄炒蛋原则', description: '把几次完成记录中的判断整理成可以复做的厨艺原则。', createdAt: '今天' },
  { id: 'cook-seasoning', projectId: 'cooking', title: '用酸甜咸比例改变味道层次', description: '沿着调味路线，找到不依赖复杂配料的平衡。', createdAt: '10/09' },
  { id: 'cook-seasoning-repeat', projectId: 'cooking', title: '让别人按调味比例复做一次', description: '验证调味方法能不能被另一个人理解和复现。', createdAt: '10/10' },
  { id: 'cook-efficiency', projectId: 'cooking', title: '把番茄炒蛋压缩到 20 分钟内', description: '只用一口锅完成准备、烹饪和清理。', createdAt: '10/09' },
  { id: 'cook-efficiency-repeat', projectId: 'cooking', title: '在工作日晚餐中再做一次', description: '验证效率路线在疲惫和时间紧张时是否仍然成立。', createdAt: '10/11' },
  { id: 'desk', projectId: 'daily', title: '把书桌整理成明天可以直接开始工作的状态', description: '清理不需要的东西，只留下明天真正会使用的物品。', createdAt: '刚刚' },
  { id: 'balcony', projectId: 'daily', title: '把阳台整理成可以坐下来的地方', description: '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', createdAt: '今天' },
  { id: 'bread', projectId: 'practice', title: '第一次做出完整的酸面包', description: '从准备酵头到烤完出炉，留下完整的一次过程记录。', createdAt: '昨天' },
  { id: 'breakfast', projectId: 'practice', title: '准备一份适合工作日的早餐', description: '用现有食材完成一次简单早餐，并记录实际花费的时间。', createdAt: '今天' },
  { id: 'reading', projectId: 'learning', title: '读完《思考，快与慢》第三章', description: '读完约定的范围，留下一个真正改变自己理解的观点。', createdAt: '今天' },
]

const demoPostImages = {
  desk: [{ url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', alt: '整理后的明亮书桌和办公空间' }],
  balcony: [
    { url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80', alt: '有座椅和绿植的阳台空间' },
    { url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', alt: '整理后可以休息的室内角落' },
  ],
  bread: [{ url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80', alt: '刚出炉的酸面包' }],
  cooking: {
    base: [{ url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80', alt: '番茄炒蛋的基础版本' }],
    heat: [{ url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80', alt: '锅中正在翻炒的家常菜' }],
    order: [{ url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=1200&q=80', alt: '处理好的新鲜番茄和食材' }],
    repeat: [
      { url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80', alt: '一锅完成的番茄炒蛋' },
      { url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80', alt: '工作日晚餐的成品记录' },
    ],
  },
}

const balconyPlanLin: PlanNode = { id: 'plan-lin-balcony', topicId: 'balcony', authorId: 'lin', parentPlanId: 'plan-desk', branchId: 'main', branchTitle: '主楼', title: '把阳台整理成可以坐下来的地方', description: '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', points: ['清理影响使用的杂物', '留出一块可以坐下来的位置', '记录还没有固定收纳的东西'], markdown: buildPlanMarkdown('把阳台整理成可以坐下来的地方', '不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。', ['清理影响使用的杂物', '留出一块可以坐下来的位置', '记录还没有固定收纳的东西']), conversation: [{ id: 'plan-lin-welcome', speaker: 'ai', body: '你准备怎么让阳台恢复使用？' }, { id: 'plan-lin-user', speaker: 'user', body: '先清掉影响使用的杂物，留出可以坐下来的位置。' }, { id: 'plan-lin-ai', speaker: 'ai', body: '那我们把计划聚焦在恢复使用，不要求一次收完所有东西。' }], status: 'completed', createdAt: '昨天 18:20' }
const balconyPlanMiao: PlanNode = { ...balconyPlanLin, id: 'plan-miao-balcony', authorId: 'miao', branchId: 'branch-balcony-route', branchTitle: '先整理行动动线', description: '先处理每天会经过的动线，再决定哪些东西需要收纳。', points: ['清出从门到椅子的通道', '擦干净可以使用的区域', '记下还需要慢慢处理的物品'], markdown: buildPlanMarkdown('把阳台整理成可以坐下来的地方', '先处理每天会经过的动线，再决定哪些东西需要收纳。', ['清出从门到椅子的通道', '擦干净可以使用的区域', '记下还需要慢慢处理的物品']), conversation: [{ id: 'plan-miao-welcome', speaker: 'ai', body: '你想先从阳台的哪一部分开始？' }, { id: 'plan-miao-user', speaker: 'user', body: '先清出每天会经过的通道，再决定哪些东西需要收纳。' }], status: 'completed', createdAt: '昨天 20:05' }
const readingPlan: PlanNode = { id: 'plan-reading', topicId: 'reading', authorId: 'jo', title: '读完《思考，快与慢》第三章', description: '用半小时读完这一章，记下一个真正改变自己理解的观点。', points: ['完成第三章的阅读', '记下一条自己的理解', '记录读不下去或卡住的地方'], markdown: buildPlanMarkdown('读完《思考，快与慢》第三章', '用半小时读完这一章，记下一个真正改变自己理解的观点。', ['完成第三章的阅读', '记下一条自己的理解', '记录读不下去或卡住的地方']), status: 'active', createdAt: '今天 09:10' }
const deskPlan: PlanNode = { id: 'plan-desk', topicId: 'desk', authorId: 'jo', title: '整理明天要用的书桌', description: '清理不需要的东西，只留下电脑、纸笔和明天要看的书。', points: ['清掉无关物品', '留下明天要用的东西', '记录仍未处理的收纳'], markdown: buildPlanMarkdown('整理明天要用的书桌', '清理不需要的东西，只留下电脑、纸笔和明天要看的书。', ['清掉无关物品', '留下明天要用的东西', '记录仍未处理的收纳']), status: 'completed', createdAt: '今天 08:30' }
const breadPlan: PlanNode = { id: 'plan-bread', topicId: 'bread', authorId: 'lin', title: '第一次做出完整的酸面包', description: '从准备酵头到烤完出炉，完成一次完整过程。', points: ['准备酵头', '记录发酵过程', '完成烘烤'], markdown: buildPlanMarkdown('第一次做出完整的酸面包', '从准备酵头到烤完出炉，完成一次完整过程。', ['准备酵头', '记录发酵过程', '完成烘烤']), status: 'completed', createdAt: '昨天 08:10' }
const breakfastPlan: PlanNode = { id: 'plan-breakfast', topicId: 'breakfast', authorId: 'jo', title: '准备一份适合工作日的早餐', description: '明早用现有食材做一份简单早餐，确认从开始到收拾完需要多久。', points: ['只使用家里现有的食材', '记录准备和收拾的时间', '留下下一次可以改进的地方'], markdown: buildPlanMarkdown('准备一份适合工作日的早餐', '明早用现有食材做一份简单早餐，确认从开始到收拾完需要多久。', ['只使用家里现有的食材', '记录准备和收拾的时间', '留下下一次可以改进的地方']), status: 'active', createdAt: '今天 07:40' }

type CookingPlanInput = {
  id: string
  topicId: string
  authorId: string
  parentPlanId?: string
  branchId: string
  branchTitle: string
  title: string
  description: string
  points: string[]
  status: PlanNode['status']
  createdAt: string
  prompt: string
  response: string
}

function makeCookingPlan(input: CookingPlanInput): PlanNode {
  const { prompt, response, ...plan } = input
  return { ...plan, markdown: buildPlanMarkdown(plan.title, plan.description, plan.points), conversation: [{ id: `${plan.id}-ai`, speaker: 'ai', body: prompt }, { id: `${plan.id}-user`, speaker: 'user', body: response }, { id: `${plan.id}-ai-followup`, speaker: 'ai', body: '完成后记下实际发生的变化，我们再决定下一步该调整什么。' }] }
}

function makeCookingCompletion(plan: PlanNode, authorId: string, actual: string, observation: string, images: NonNullable<CompletionNode['images']>, believeCount: number, doubtCount: number, createdAt: string): CompletionNode {
  return { id: `completion-${plan.id}`, topicId: plan.topicId, planNodeId: plan.id, authorId, title: `${plan.title}：完成记录`, markdown: `# ${plan.title}：完成记录\n\n## 原计划\n\n${plan.description}\n\n## 这次实际发生\n\n${actual}\n\n## 这次留下的观察\n\n${observation}`, images, conversation: [...(plan.conversation ?? []), { id: `${plan.id}-completion-user`, speaker: 'user', body: actual }, { id: `${plan.id}-completion-ai`, speaker: 'ai', body: '这次记录已经保留。下一步可以只改变一个变量，再看结果能不能稳定复现。' }], believeCount, doubtCount, createdAt }
}

const cookPlanBase = makeCookingPlan({ id: 'plan-cook-base', topicId: 'cook-base', authorId: 'jo', branchId: 'main', branchTitle: '主楼', title: '用同一组食材完成番茄炒蛋基础版', description: '固定 4 个鸡蛋、2 个番茄、盐和油，先做出每个人自己的原始版本。', points: ['记录食材和用量', '记录从准备到出锅的时间', '拍下成品并写下最明显的问题'], status: 'completed', createdAt: '10/08 18:20', prompt: '我们先不追求最好吃，先把同一组食材做出一个可以比较的基础版本。', response: '我会固定鸡蛋、番茄、盐和油，先记录自己原本会怎么做。' })
const cookPlanHeat = makeCookingPlan({ id: 'plan-cook-heat', topicId: 'cook-heat', authorId: 'lin', parentPlanId: cookPlanBase.id, branchId: 'main', branchTitle: '主楼', title: '只调整鸡蛋火候，找到稳定口感', description: '不改变食材和调味，只比较鸡蛋不同起锅时间对口感的影响。', points: ['做两次不同火候的鸡蛋', '记录起锅时机和口感', '选出下一次愿意复做的状态'], status: 'completed', createdAt: '10/09 19:10', prompt: '基础版本的问题先不要全部一起改，我们这次只看鸡蛋火候。', response: '我会保留原来的番茄和调味，只提前或延后鸡蛋起锅。' })
const cookPlanOrder = makeCookingPlan({ id: 'plan-cook-order', topicId: 'cook-order', authorId: 'miao', parentPlanId: cookPlanHeat.id, branchId: 'main', branchTitle: '主楼', title: '只调整番茄处理和下锅顺序', description: '比较番茄直接下锅、先收汁和最后回锅三种顺序。', points: ['保持鸡蛋火候不变', '记录番茄出汁和酸度', '说明哪一种顺序更适合自己的口味'], status: 'completed', createdAt: '10/10 18:40', prompt: '现在鸡蛋的状态有了方向，下一步只改变番茄的处理顺序。', response: '我想先处理番茄的出汁，再看什么时候让鸡蛋和番茄重新碰到一起。' })
const cookPlanRepeat = makeCookingPlan({ id: 'plan-cook-repeat', topicId: 'cook-repeat', authorId: 'jo', parentPlanId: cookPlanOrder.id, branchId: 'main', branchTitle: '主楼', title: '在工作日晚餐、20 分钟和一口锅限制下复做番茄炒蛋', description: '把前面确认的做法放进真实工作日晚餐，验证它是否仍然成立。', points: ['从准备到清理控制在 20 分钟内', '只使用一口锅', '连续复做两次并记录差异'], status: 'completed', createdAt: '10/11 19:30', prompt: '前面的方法在从容时成立还不够，我们把它放回普通工作日。', response: '我会只用一口锅，记录准备、烹饪和清理的总时间。' })
const cookPlanPrinciples = makeCookingPlan({ id: 'plan-cook-principles', topicId: 'cook-principles', authorId: 'jo', parentPlanId: cookPlanRepeat.id, branchId: 'main', branchTitle: '主楼', title: '整理出自己的番茄炒蛋原则', description: '把几次完成记录中的判断整理成可以解释、复做和交给别人验证的厨艺原则。', points: ['写下最重要的三个判断', '标记哪些结论仍然没有证据', '邀请另一个人按这套原则复做'], status: 'active', createdAt: '今天 09:30', prompt: '我们已经有几次实际结果了，现在可以开始整理自己的判断，但不要急着把猜想写成结论。', response: '我会把火候、顺序和时间限制分别写清楚，再邀请别人按这个方法复做。' })
const cookPlanSeasoning = makeCookingPlan({ id: 'plan-cook-seasoning', topicId: 'cook-seasoning', authorId: 'lin', parentPlanId: cookPlanBase.id, branchId: 'branch-cook-seasoning', branchTitle: '调味路线', title: '用酸甜咸比例改变味道层次', description: '不改变基本做法，只比较糖、盐和番茄本身的酸度如何形成平衡。', points: ['记录三种调味比例', '邀请至少一人盲尝', '留下自己愿意复做的比例'], status: 'completed', createdAt: '10/09 18:30', prompt: '你可以从基础版本分出一条调味路线，只改变味道层次，不要同时改变火候。', response: '我想先确认番茄本身的酸度，再用很少的糖和盐把味道托起来。' })
const cookPlanSeasoningRepeat = makeCookingPlan({ id: 'plan-cook-seasoning-repeat', topicId: 'cook-seasoning-repeat', authorId: 'miao', parentPlanId: cookPlanSeasoning.id, branchId: 'branch-cook-seasoning', branchTitle: '调味路线', title: '让别人按调味比例复做一次', description: '把调味比例写清楚，看看另一个人能否在不同番茄上做出接近的结果。', points: ['写出可执行的调味顺序', '让另一个人独立复做', '比较两次成品的差异'], status: 'completed', createdAt: '10/10 20:10', prompt: '调味路线要继续，就需要证明它不是只有你自己能做出来。', response: '我会把比例和加入时机写清楚，让别人不看我的锅也能复做。' })
const cookPlanEfficiency = makeCookingPlan({ id: 'plan-cook-efficiency', topicId: 'cook-efficiency', authorId: 'miao', parentPlanId: cookPlanBase.id, branchId: 'branch-cook-efficiency', branchTitle: '效率路线', title: '把番茄炒蛋压缩到 20 分钟内', description: '只用一口锅完成准备、烹饪和清理，看看效率是否会牺牲口感。', points: ['准备和烹饪总计不超过 20 分钟', '只使用一口锅', '记录为了省时间牺牲了什么'], status: 'completed', createdAt: '10/09 20:00', prompt: '也可以从基础版本分出效率路线，先验证这道菜是否适合真实工作日晚餐。', response: '我会先把切菜顺序和锅具准备好，只用一口锅完成整顿饭。' })
const cookPlanEfficiencyRepeat = makeCookingPlan({ id: 'plan-cook-efficiency-repeat', topicId: 'cook-efficiency-repeat', authorId: 'miao', parentPlanId: cookPlanEfficiency.id, branchId: 'branch-cook-efficiency', branchTitle: '效率路线', title: '在工作日晚餐中再做一次', description: '在疲惫和时间紧张的晚上复做，验证效率路线是否仍然成立。', points: ['记录开始前的准备阻力', '保持 20 分钟限制', '比较这次和第一次的口感'], status: 'completed', createdAt: '10/11 20:20', prompt: '第一次快做出来还不够，真正适合生活的方法需要在疲惫时也能启动。', response: '我会在下班后直接复做，不提前准备食材，看看这条路线是否足够轻。' })

const cookingPlans = [cookPlanBase, cookPlanHeat, cookPlanOrder, cookPlanRepeat, cookPlanPrinciples, cookPlanSeasoning, cookPlanSeasoningRepeat, cookPlanEfficiency, cookPlanEfficiencyRepeat]
const initialPlans: PlanNode[] = [...cookingPlans, readingPlan, breakfastPlan, deskPlan, balconyPlanLin, balconyPlanMiao, breadPlan]
const initialCompletions: CompletionNode[] = [
  makeCookingCompletion(cookPlanBase, 'jo', '第一次做出来的版本偏湿，鸡蛋有些老，整个过程用了 24 分钟。', '基础版本的问题很清楚：番茄出汁太早，鸡蛋在锅里停留太久。', demoPostImages.cooking.base, 8, 1, '10/08 19:05'),
  makeCookingCompletion(cookPlanHeat, 'lin', '这次只提前 20 秒把鸡蛋起锅，最后回锅时仍然保持嫩滑，时间没有明显增加。', '火候比想象中更值得先解决，调味还没有必要急着变复杂。', demoPostImages.cooking.heat, 15, 2, '10/09 19:45'),
  makeCookingCompletion(cookPlanOrder, 'miao', '番茄先单独收汁后再和鸡蛋混合，酸味更集中，盘底没有多余的水。', '下锅顺序改变了口感层次，但番茄成熟度不同的时候还需要再验证。', demoPostImages.cooking.order, 12, 1, '10/10 19:20'),
  makeCookingCompletion(cookPlanRepeat, 'jo', '两次都在 20 分钟内完成：第一次从切菜到出锅用了 17 分钟，第二次因为番茄出汁较多多收了 2 分钟，清理只用了 3 分钟；两次鸡蛋都保持嫩滑，口感和第一次接近，说明这套做法在普通工作日晚餐里也能稳定复做。', '这套方法终于从一次好吃变成了可以在工作日复做的做法。', demoPostImages.cooking.repeat, 20, 2, '10/11 20:05'),
  makeCookingCompletion(cookPlanSeasoning, 'lin', '三种比例中，少糖加盐的版本最能保留番茄味，盲尝时两个人都选了这一盘。', '调味可以改变层次，但它没有解决鸡蛋变老的问题。', demoPostImages.cooking.base, 11, 2, '10/09 19:25'),
  makeCookingCompletion(cookPlanSeasoningRepeat, 'miao', '按记录的比例复做后味道接近，但番茄偏酸时仍然需要临场微调。', '调味路线可以被复做，但还没有形成足够稳定的范围。', demoPostImages.cooking.order, 9, 2, '10/10 21:00'),
  makeCookingCompletion(cookPlanEfficiency, 'miao', '从切菜到洗锅用了 18 分钟，只用一口锅，但鸡蛋口感比基础版本更老。', '效率确实提高了，下一次需要找到不牺牲火候的省时办法。', demoPostImages.cooking.heat, 8, 3, '10/09 20:35'),
  makeCookingCompletion(cookPlanEfficiencyRepeat, 'miao', '下班后没有提前准备，仍然在 20 分钟内完成，但番茄收汁不够，味道偏淡。', '效率路线适合启动，却还不能单独代表最稳定的结果。', demoPostImages.cooking.repeat.slice(0, 1), 6, 2, '10/11 20:55'),
  { id: 'completion-desk', topicId: 'desk', planNodeId: deskPlan.id, authorId: 'jo', title: '整理明天要用的书桌：完成记录', markdown: '# 整理明天要用的书桌：完成记录\n\n## 这次实际发生\n\n清掉了桌上的杯子和纸张，只留下电脑和明天要看的书。\n\n## 这次留下的观察\n\n抽屉还没有整理，但桌面已经可以直接开始工作。', images: demoPostImages.desk, believeCount: 6, doubtCount: 0, createdAt: '今天 08:55' },
  { id: 'completion-lin-balcony', topicId: 'balcony', planNodeId: balconyPlanLin.id, authorId: 'lin', title: '把阳台整理成可以坐下来的地方：完成记录', markdown: '# 把阳台整理成可以坐下来的地方：完成记录\n\n## 原计划\n\n不追求一次处理所有旧物，先让阳台重新成为一个可以使用的地方。\n\n## 这次实际发生\n\n清掉了地上的箱子和不用的纸袋，擦干净了地面，留下了一把椅子和一盏灯。\n\n## 这次留下的观察\n\n晚上终于愿意坐在那里了，但旧物还没有固定收纳。', images: demoPostImages.balcony, conversation: [...(balconyPlanLin.conversation ?? []), { id: 'completion-lin-user', speaker: 'user', body: '清掉了箱子和纸袋，擦干净地面，留下了一把椅子和一盏灯。' }, { id: 'completion-lin-ai', speaker: 'ai', body: '我会把已经发生的部分和还没处理的旧物分开记录。' }], believeCount: 18, doubtCount: 3, createdAt: '今天 09:20' },
  { id: 'completion-miao-balcony', topicId: 'balcony', planNodeId: balconyPlanMiao.id, authorId: 'miao', title: '把阳台整理成可以坐下来的地方：完成记录', markdown: '# 把阳台整理成可以坐下来的地方：完成记录\n\n## 原计划\n\n先处理每天会经过的动线，再决定哪些东西需要收纳。\n\n## 这次实际发生\n\n先清出了从门到椅子的通道，擦干了可以使用的区域。旧花盆还没有处理，但晚上已经可以坐下来。\n\n## 这次留下的观察\n\n先让空间恢复使用，比一次整理完所有东西更容易开始。', images: demoPostImages.balcony.slice(0, 1), conversation: [...(balconyPlanMiao.conversation ?? []), { id: 'completion-miao-user', speaker: 'user', body: '先清出了从门到椅子的通道，晚上已经可以坐下来。' }], believeCount: 12, doubtCount: 1, createdAt: '昨天 21:08' },
  { id: 'completion-lin-bread', topicId: 'bread', planNodeId: 'plan-bread', authorId: 'lin', title: '第一次做出完整的酸面包：完成记录', markdown: '# 第一次做出完整的酸面包：完成记录\n\n## 这次实际发生\n\n从准备酵头到烤完出炉，第一次把整个过程做完了。\n\n## 这次留下的观察\n\n下次想把发酵时间记得更准确。', images: demoPostImages.bread, believeCount: 9, doubtCount: 0, createdAt: '昨天 09:20' },
]

export function App() {
  const [route, navigate] = useHashRoute('my', isAppView)
  const authRoute = useAuthRoute()
  const [profile, setProfile] = useState(currentUser)
  const [projects, setProjects] = useState(initialProjects)
  const [topics, setTopics] = useState(initialTopics)
  const [plans, setPlans] = useState(initialPlans)
  const [actions, setActions] = useState<ActionNode[]>(demoActions)
  const [completions, setCompletions] = useState(initialCompletions)
  const [aiConfigs, setAIConfigs] = useState<AIKeyConfig[]>(initialAIConfigs)
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})
  const followingIds = ['lin']
  const [darkMode, setDarkMode] = useState(false)
  const [graphBackground, setGraphBackground] = useGraphBackground()
  const [showActionGraphLegend, setShowActionGraphLegend] = useState(() => {
    try { return window.localStorage.getItem(legendPreferenceKey) === 'true' } catch { return false }
  })
  const [selectedTopicId, setSelectedTopicId] = useState('balcony')
  const [selectedProjectId, setSelectedProjectId] = useState(() => readProjectIdFromHash() ?? 'daily')
  const [projectBackView, setProjectBackView] = useState<'my' | 'projects'>('my')
  const [workspaceMode, setWorkspaceMode] = useState<'planning' | 'completion' | 'action'>('planning')
  const [workspacePlan, setWorkspacePlan] = useState<PlanNode | undefined>()
  const [workspaceCompletion, setWorkspaceCompletion] = useState<CompletionNode | undefined>()
  const [workspaceTopicId, setWorkspaceTopicId] = useState<string | undefined>()
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | undefined>()
  const [workspaceParentPlan, setWorkspaceParentPlan] = useState<PlanNode | undefined>()
  const [workspaceBranchMode, setWorkspaceBranchMode] = useState<BranchMode>('fork')
  const [workspaceActionParent, setWorkspaceActionParent] = useState<ActionNode>()
  const [workspaceActionId, setWorkspaceActionId] = useState<string>()
  const [archiveActionId, setArchiveActionId] = useState<string>()

  useEffect(() => { if (darkMode) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme') }, [darkMode])
  useEffect(() => { try { window.localStorage.setItem(legendPreferenceKey, String(showActionGraphLegend)) } catch { /* Browser storage may be unavailable. */ } }, [showActionGraphLegend])
  useEffect(() => { window.scrollTo(0, 0) }, [route, authRoute])
  useEffect(() => {
    const syncProjectFromHash = () => {
      const hashRoute = window.location.hash.slice(1).split('?')[0]
      if (hashRoute !== 'project') return
      const projectId = readProjectIdFromHash()
      if (projectId) setSelectedProjectId(projectId)
    }
    window.addEventListener('hashchange', syncProjectFromHash)
    return () => window.removeEventListener('hashchange', syncProjectFromHash)
  }, [])

  if (authRoute) return <AuthScreen view={authRoute} onEnter={() => navigate('my')} />

  const openTopic = (topicId: string) => { setSelectedTopicId(topicId); navigate('topic') }
  const openProject = (projectId: string, backView?: 'my' | 'projects') => { setSelectedProjectId(projectId); if (backView) setProjectBackView(backView); window.location.hash = `project?projectId=${encodeURIComponent(projectId)}` }
  const openActionArchive = (node: ActionNode) => { setSelectedProjectId(node.projectId); setArchiveActionId(node.id); navigate('action-archive') }
  const startAction = (projectId: string, parent?: ActionNode, branchMode: BranchMode = 'fork') => { setWorkspaceMode('action'); setWorkspaceActionParent(parent); setWorkspaceActionId(undefined); setWorkspaceProjectId(projectId); setWorkspaceTopicId(undefined); setWorkspaceBranchMode(branchMode); navigate('publish') }
  const startPlanning = (topicId?: string, projectId?: string, parentPlan?: PlanNode, branchMode: BranchMode = 'fork') => { const topic = topics.find((item) => item.id === topicId); setWorkspaceMode('planning'); setWorkspacePlan(undefined); setWorkspaceCompletion(undefined); setWorkspaceParentPlan(parentPlan); setWorkspaceBranchMode(branchMode); setWorkspaceTopicId(topicId); setWorkspaceProjectId(projectId ?? topic?.projectId ?? projects[0].id); navigate('publish') }
  const openPlanInteraction = (plan: PlanNode) => { const topic = topics.find((item) => item.id === plan.topicId); setWorkspaceMode('planning'); setWorkspacePlan(plan); setWorkspaceCompletion(undefined); setWorkspaceParentPlan(undefined); setWorkspaceBranchMode('continue'); setWorkspaceTopicId(plan.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const startCompletion = (plan: PlanNode) => { const topic = topics.find((item) => item.id === plan.topicId); setWorkspaceMode('completion'); setWorkspacePlan(plan); setWorkspaceCompletion(completions.find((item) => item.planNodeId === plan.id)); setWorkspaceParentPlan(undefined); setWorkspaceTopicId(plan.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const openCompletionInteraction = (completion: CompletionNode) => { const plan = plans.find((item) => item.id === completion.planNodeId); const topic = topics.find((item) => item.id === completion.topicId); if (!plan) return; setWorkspaceMode('completion'); setWorkspacePlan(plan); setWorkspaceCompletion(completion); setWorkspaceParentPlan(undefined); setWorkspaceTopicId(completion.topicId); setWorkspaceProjectId(topic?.projectId); navigate('publish') }
  const createProject = (input: CreateProjectInput) => {
    const id = `project-${Date.now()}`
    const now = new Date().toISOString()
    const description = input.description.trim() || '从这里开始记录行动。'
    const project: Project = { id, ownerId: profile.id, participantIds: [], title: input.title, description, createdAt: now, updatedAt: now }
    const initialAction: ActionNode = { id: `action-${Date.now()}-root`, projectId: id, number: 1, authorId: profile.id, title: input.title, markdown: `# ${input.title}\n\n${description}`, objectiveMarkdown: `# ${input.title}\n\n${description}`, contextSnapshot: { directNodeIds: [], historyNodeCount: 0 }, images: [], conversation: [], createdAt: now }
    setProjects((current) => [project, ...current])
    setActions((current) => [initialAction, ...current])
    openProject(id, 'projects')
  }
  const updateProject = (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => {
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project))
  }
  const saveAIConfig = (input: SaveAIKeyInput) => setAIConfigs((current) => [...current, { ...input, id: `ai-key-${Date.now()}`, isDefault: current.length === 0 }])
  const setDefaultAIConfig = (id: string) => setAIConfigs((current) => current.map((config) => ({ ...config, isDefault: config.id === id })))
  const deleteAIConfig = (id: string) => setAIConfigs((current) => { const remaining = current.filter((config) => config.id !== id); if (remaining.length && !remaining.some((config) => config.isDefault)) remaining[0] = { ...remaining[0], isDefault: true }; return remaining })

  const confirmWorkspace = (markdown: string, details: { title: string; description: string; points: string[]; note: string }, conversation: ChatMessage[], expressionMarkdown?: string) => {
    if (workspaceMode === 'action') {
      if (!workspaceProjectId) return
      const projectActions = actions.filter((action) => action.projectId === workspaceProjectId)
      const project = projects.find((item) => item.id === workspaceProjectId)
      const action: ActionNode = { id: `action-${Date.now()}`, projectId: workspaceProjectId, number: Math.max(0, ...projectActions.map((item) => item.number)) + 1, parentId: workspaceActionParent?.id, authorId: profile.id, title: details.title || '一次行动记录', markdown, objectiveMarkdown: markdown, expressionMarkdown, contextSnapshot: { directNodeIds: workspaceActionParent ? [workspaceActionParent.id] : [], historyNodeCount: workspaceActionParent ? getActionContextIds(projectActions, workspaceActionParent.id).size : 0, guide: project?.contextGuide }, images: [], conversation, createdAt: new Date().toISOString() }
      setActions((current) => [action, ...current])
      openProject(workspaceProjectId)
      return
    }
    if (workspaceMode === 'planning') {
      if (workspacePlan) {
        setPlans((current) => current.map((plan) => plan.id === workspacePlan.id ? { ...plan, title: details.title, description: details.description, points: details.points, markdown, conversation } : plan))
        if (workspaceProjectId) openProject(workspaceProjectId); else navigate('my')
        return
      }
      const topicId = workspaceTopicId ?? `topic-${Date.now()}`
      const projectId = workspaceProjectId ?? projects[0].id
      if (!workspaceTopicId) setTopics((current) => [{ id: topicId, projectId, title: details.title, description: details.description, createdAt: '刚刚' }, ...current])
      const planId = `plan-${Date.now()}`
      const projectPlans = plans.filter((item) => topics.find((topic) => topic.id === item.topicId)?.projectId === projectId)
      const branchId = workspaceParentPlan && workspaceBranchMode === 'continue' ? getPlanBranchId(workspaceParentPlan) : projectPlans.length ? `branch-${planId}` : 'main'
      const plan: PlanNode = { id: planId, topicId, authorId: profile.id, parentPlanId: workspaceParentPlan?.id, branchId, branchTitle: workspaceParentPlan && workspaceBranchMode === 'continue' ? getPlanBranchTitle(workspaceParentPlan) : branchId === 'main' ? '主楼' : details.title, title: details.title, description: details.description, points: details.points, markdown, conversation, status: 'active', createdAt: '刚刚' }
      setPlans((current) => [plan, ...current])
      setSelectedProjectId(projectId)
      navigate('project')
      return
    }
    if (!workspacePlan) return
    if (workspaceCompletion) {
      setCompletions((current) => current.map((completion) => completion.id === workspaceCompletion.id ? { ...completion, markdown, conversation, createdAt: '刚刚更新' } : completion))
      if (workspaceProjectId) openProject(workspaceProjectId); else navigate('my')
      return
    }
    const completion: CompletionNode = { id: `completion-${Date.now()}`, topicId: workspacePlan.topicId, planNodeId: workspacePlan.id, authorId: profile.id, title: `${workspacePlan.title}：完成记录`, markdown, conversation, believeCount: 0, doubtCount: 0, createdAt: '刚刚' }
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
  const selectedProjectActions = actions.filter((action) => action.projectId === selectedProject.id)
  const allUsers = [profile, lin, miao, ...cookingParticipants]
  const ownPlans = plans.filter((plan) => plan.authorId === profile.id)
  const ownCompletions = completions.filter((completion) => completion.authorId === profile.id)
  const activeAIConfig = aiConfigs.find((config) => config.isDefault) ?? aiConfigs[0]
  const archiveAction = actions.find((action) => action.id === archiveActionId)

  return <AppShell profile={profile} profileStats={{ createdProjects: projects.filter((project) => project.ownerId === profile.id).length, completedRecords: ownCompletions.length }} activeView={route} darkMode={darkMode} projectTitle={selectedProject.title} backAction={route === 'project' ? { label: projectBackView === 'projects' ? '返回所有行动图' : '返回我的', onBack: () => navigate(projectBackView) } : undefined} onToggleTheme={() => setDarkMode((current) => !current)} onLogout={() => { window.location.hash = 'login' }}>
    {route === 'home' && <FeedPage title="公开完成记录" eyebrow="大家最近完成的事情" completions={visibleCompletions} topics={topics} plans={plans} users={allUsers} reactions={reactions} onReaction={onReaction} onOpenTopic={openTopic} onParallel={startPlanning} />}
    {route === 'following' && <FeedPage title="最新完成记录" eyebrow="来自你关注的人" completions={visibleCompletions} topics={topics} plans={plans} users={allUsers} reactions={reactions} onReaction={onReaction} onOpenTopic={openTopic} onParallel={startPlanning} />}
    {route === 'publish' && workspaceMode === 'action' ? <ActionWorkspace key={`action-${workspaceActionParent?.id ?? 'root'}-${workspaceActionId ?? 'new'}`} profileName={profile.name} aiConfig={activeAIConfig} contextTitle={workspaceActionParent?.title} inheritedExpression={workspaceActionParent ? getActionExpression(actions, workspaceActionParent.id).markdown : ''} contextGuide={projects.find((item) => item.id === workspaceProjectId)?.contextGuide} onBack={() => workspaceProjectId ? openProject(workspaceProjectId) : navigate('my')} onConfirm={confirmWorkspace} /> : route === 'publish' && <AIWorkspace key={`${workspaceMode}-${workspacePlan?.id ?? 'new'}-${workspaceCompletion?.id ?? 'new'}-${workspaceParentPlan?.id ?? 'root'}`} mode={workspaceMode === 'completion' ? 'completion' : 'planning'} profileName={profile.name} aiConfig={activeAIConfig} plan={workspacePlan} contextPlan={workspaceParentPlan} topicTitle={workspaceTopicId ? topics.find((topic) => topic.id === workspaceTopicId)?.title : undefined} initialDocument={workspaceMode === 'planning' ? workspacePlan?.markdown : workspaceCompletion?.markdown ?? workspacePlan?.markdown} initialMessages={workspaceMode === 'planning' ? workspacePlan?.conversation : workspaceCompletion?.conversation ?? workspacePlan?.conversation} continuationFromPlan={workspaceMode === 'completion' && !workspaceCompletion} onStartCompletion={workspaceMode === 'planning' && workspacePlan?.status === 'active' ? () => startCompletion(workspacePlan) : undefined} onBack={() => workspaceProjectId ? openProject(workspaceProjectId) : navigate('my')} onConfirm={confirmWorkspace} />}
    {route === 'my' && <MyPage profile={profile} projects={projects} plans={ownPlans} completions={ownCompletions} topics={topics} onOpenProject={(projectId) => openProject(projectId, 'my')} onOpenPlan={(plan) => { setProjectBackView('my'); openPlanInteraction(plan) }} onOpenCompletion={(completion) => { setProjectBackView('my'); openCompletionInteraction(completion) }} />}
    {route === 'profile' && <ProfilePage users={allUsers} projects={projects} actions={actions} onOpenProject={openProject} />}
    {route === 'project' && <ProjectPage key={selectedProject.id} project={selectedProject} currentUserId={profile.id} users={allUsers} actions={selectedProjectActions} showActionGraphLegend={showActionGraphLegend} graphBackground={graphBackground} onCreateAction={startAction} onContinueAction={(node, mode) => startAction(selectedProject.id, node, mode)} onOpenActionArchive={openActionArchive} onUpdateProject={updateProject} />}
    {route === 'action-archive' && archiveAction && <ActionArchivePage project={selectedProject} node={archiveAction} actions={selectedProjectActions} users={allUsers} onBack={() => openProject(selectedProject.id)} />}
    {route === 'projects' && <ProjectsPage currentUserId={profile.id} projects={projects} topics={topics} plans={plans} completions={completions} onBack={() => navigate('my')} onCreateProject={createProject} onOpenProject={(projectId) => openProject(projectId, 'projects')} />}
    {route === 'topic' && <TopicPage topic={selectedTopic} plans={plans.filter((plan) => plan.topicId === selectedTopic.id)} completions={completions.filter((completion) => completion.topicId === selectedTopic.id)} users={allUsers} reactions={reactions} onBack={() => navigate('home')} onReaction={onReaction} onParallel={startPlanning} onContinuePlan={(plan, branchMode) => startPlanning(plan.topicId, selectedTopic.projectId, plan, branchMode)} />}
    {route === 'settings' && <SettingsPanel profile={profile} darkMode={darkMode} showActionGraphLegend={showActionGraphLegend} graphBackground={graphBackground} onGraphBackgroundChange={setGraphBackground} aiConfigs={aiConfigs} onSave={setProfile} onToggleTheme={() => setDarkMode((current) => !current)} onShowActionGraphLegendChange={setShowActionGraphLegend} onSaveAIConfig={saveAIConfig} onSetDefaultAIConfig={setDefaultAIConfig} onDeleteAIConfig={deleteAIConfig} />}
  </AppShell>
}

function readProjectIdFromHash() {
  const query = window.location.hash.split('?')[1]
  return query ? new URLSearchParams(query).get('projectId') : null
}

function useAuthRoute() {
  const [route, setRoute] = useState<AuthView | null>(() => { const value = window.location.hash.slice(1); return isAuthView(value) ? value : null })
  useEffect(() => { const handleHashChange = () => { const value = window.location.hash.slice(1); setRoute(isAuthView(value) ? value : null) }; window.addEventListener('hashchange', handleHashChange); return () => window.removeEventListener('hashchange', handleHashChange) }, [])
  return route
}
