import { Bot, CheckCircle2, FileCheck2, GitBranchPlus, GitFork, Settings2, type LucideIcon } from 'lucide-react'

export type CurrentNodeCopy = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  actionLabel: string
}

export type ProjectTab = 'nodes' | 'records' | 'graph' | 'profile' | 'ai'

export const projectTabs: Array<{ id: ProjectTab; label: string; icon: LucideIcon }> = [
  { id: 'nodes', label: '行动', icon: FileCheck2 },
  { id: 'records', label: '成果与封存', icon: CheckCircle2 },
  { id: 'graph', label: '关系图', icon: GitFork },
  { id: 'profile', label: '项目资料', icon: Settings2 },
  { id: 'ai', label: '审查 AI', icon: Bot },
]

export const projectTabFrom = (value: string | null): ProjectTab =>
  value === 'records' || value === 'graph' || value === 'profile' || value === 'ai' ? value : 'nodes'

export const currentNodeCopy = (contract: { stage: string }): CurrentNodeCopy => {
  if (contract.stage === 'verified') {
    return { icon: CheckCircle2, eyebrow: '待确认行动记录', title: '确认当前现实状态', description: 'AI 已整理这次行动记录。请确认它是否如实反映当前情况；这不代表 AI 已证明最终效果。', actionLabel: '确认并保存' }
  }
  if (contract.stage === 'needs_supplement') {
    return { icon: GitBranchPlus, eyebrow: '记录有缺口', title: '补充记录或继续行动', description: 'AI 指出了尚未记录或确认的部分。你可以补充当前记录、继续观察，或创建下一步行动。', actionLabel: '处理记录' }
  }
  return { icon: FileCheck2, eyebrow: '待推进', title: '记录这次行动', description: '这条行动已经准备好推进。完成后记录实际发生的事情，再请 AI 帮你整理。', actionLabel: '记录行动' }
}

export const recordDate = (record: { createdAt: string }) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))
