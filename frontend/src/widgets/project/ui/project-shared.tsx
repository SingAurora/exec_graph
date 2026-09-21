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
    return { icon: CheckCircle2, eyebrow: '待确认 AI 结果', title: '确认 AI 审查结果', description: 'AI 已通过审查。确认后会生成一条可接续的已验收成果。', actionLabel: '确认验收' }
  }
  if (contract.stage === 'needs_supplement') {
    return { icon: GitBranchPlus, eyebrow: '有缺口', title: '补足缺口或封存行动', description: 'AI 指出了未满足项。继续补足会保留这次行动的上下文；封存只保留记录，不会成为已验收成果。', actionLabel: '处理缺口' }
  }
  return { icon: FileCheck2, eyebrow: '待推进', title: '提交这次推进结果', description: '这条节点已经准备好推进。提交结果后，会进入待确认 AI 结果。', actionLabel: '提交结果' }
}

export const recordDate = (record: { createdAt: string }) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))
