export type PublicMember = {
  handle: string
  name: string
  role: string
  bio: string
  color: string
  projectCount: number
  completionCount: number
  activeDays: number
}

export type PublicProject = {
  id: string
  title: string
  description: string
  ownerHandle: string
  smartContract: string
  nodeCount: number
  completionCount: number
  branchCount: number
  latestLockedAt: string
  visibility: 'public'
  path: Array<{ title: string; state: 'locked' | 'pending' | 'reviewing' }>
}

export type PublicCompletion = {
  id: string
  title: string
  summary: string
  ownerHandle: string
  projectID: string
  projectTitle: string
  coveredNodeCount: number
  aiPassed: boolean
  createdAt: string
}

export const publicMembers: PublicMember[] = [
  {
    handle: '@linzhou',
    name: '林舟',
    role: '产品设计师',
    bio: '把模糊产品判断写成能被验证的推进记录。',
    color: 'bg-[#365f54]',
    projectCount: 1,
    completionCount: 1,
    activeDays: 16,
  },
  {
    handle: '@qiaoye',
    name: '乔野',
    role: '独立开发者',
    bio: '用短周期节点完成一套可复查的个人工具。',
    color: 'bg-[#7d4a3b]',
    projectCount: 1,
    completionCount: 1,
    activeDays: 12,
  },
  {
    handle: '@mori',
    name: '森',
    role: '研究者',
    bio: '公开研究过程，也公开没有通过的审查结论。',
    color: 'bg-[#46577d]',
    projectCount: 1,
    completionCount: 1,
    activeDays: 20,
  },
  {
    handle: '@yuan',
    name: '远',
    role: '写作者',
    bio: '把长期写作拆成可锁定的小型论证。',
    color: 'bg-[#735c36]',
    projectCount: 1,
    completionCount: 1,
    activeDays: 9,
  },
]

export const publicProjects: PublicProject[] = [
  {
    id: 'public-research-map',
    title: 'AI 产品审查研究图谱',
    description: '比较不同审查框架如何定义目标、证据与人类最终确认。',
    ownerHandle: '@mori',
    smartContract: '研究自证智能合约',
    nodeCount: 14,
    completionCount: 6,
    branchCount: 3,
    latestLockedAt: '2026-09-07T14:20:00.000Z',
    visibility: 'public',
    path: [
      { title: '界定审查框架的比较维度', state: 'locked' },
      { title: '补齐可复查的案例来源', state: 'locked' },
      { title: '整理框架之间的差异结论', state: 'pending' },
    ],
  },
  {
    id: 'public-reading-system',
    title: '构建可复查的阅读系统',
    description: '从选书、摘录到输出，验证一套不会堆积的阅读流程。',
    ownerHandle: '@linzhou',
    smartContract: '习惯实验智能合约',
    nodeCount: 9,
    completionCount: 4,
    branchCount: 2,
    latestLockedAt: '2026-09-06T19:05:00.000Z',
    visibility: 'public',
    path: [
      { title: '验证每周选书的边界', state: 'locked' },
      { title: '建立摘录到输出的索引', state: 'reviewing' },
    ],
  },
  {
    id: 'public-home-lab',
    title: '一人家庭实验室',
    description: '把家庭工具改造变成可验证、可复用的实验记录。',
    ownerHandle: '@qiaoye',
    smartContract: '实作验证智能合约',
    nodeCount: 11,
    completionCount: 5,
    branchCount: 2,
    latestLockedAt: '2026-09-05T11:40:00.000Z',
    visibility: 'public',
    path: [
      { title: '完成传感器布线与记录基线', state: 'locked' },
      { title: '复查两周的数据误差', state: 'pending' },
    ],
  },
  {
    id: 'public-essay-series',
    title: '完成一组城市观察短文',
    description: '用节点链推进选题、走访、初稿与事实核验。',
    ownerHandle: '@yuan',
    smartContract: '写作证据智能合约',
    nodeCount: 8,
    completionCount: 3,
    branchCount: 1,
    latestLockedAt: '2026-09-03T21:10:00.000Z',
    visibility: 'public',
    path: [
      { title: '完成旧城区走访笔记', state: 'locked' },
      { title: '核验三处历史描述', state: 'pending' },
    ],
  },
]

export const publicCompletions: PublicCompletion[] = [
  {
    id: 'completion-research-source',
    title: '补齐审查案例的原始来源',
    summary: '锁定了六份可定位的原始资料，并把每一份与比较维度建立对应。',
    ownerHandle: '@mori',
    projectID: 'public-research-map',
    projectTitle: 'AI 产品审查研究图谱',
    coveredNodeCount: 2,
    aiPassed: true,
    createdAt: '2026-09-07T14:20:00.000Z',
  },
  {
    id: 'completion-reading-index',
    title: '完成摘录到输出的索引草案',
    summary: '产出可查找的索引模板，并用三篇已读文章验证回溯路径。',
    ownerHandle: '@linzhou',
    projectID: 'public-reading-system',
    projectTitle: '构建可复查的阅读系统',
    coveredNodeCount: 1,
    aiPassed: true,
    createdAt: '2026-09-06T19:05:00.000Z',
  },
  {
    id: 'completion-lab-baseline',
    title: '建立家庭实验室的数据基线',
    summary: '完成传感器安装和七天原始记录，但保留了一项校准误差。',
    ownerHandle: '@qiaoye',
    projectID: 'public-home-lab',
    projectTitle: '一人家庭实验室',
    coveredNodeCount: 3,
    aiPassed: false,
    createdAt: '2026-09-05T11:40:00.000Z',
  },
  {
    id: 'completion-city-notes',
    title: '锁定旧城区走访笔记',
    summary: '完成四处走访和一份可引用的观察笔记，形成后续短文的事实基础。',
    ownerHandle: '@yuan',
    projectID: 'public-essay-series',
    projectTitle: '完成一组城市观察短文',
    coveredNodeCount: 2,
    aiPassed: true,
    createdAt: '2026-09-03T21:10:00.000Z',
  },
]

export function publicMember(handle: string) {
  return publicMembers.find((member) => member.handle.replace('@', '') === handle.replace('@', ''))
}

export function memberInitials(member: PublicMember) {
  return member.name.slice(0, 2).toUpperCase()
}
