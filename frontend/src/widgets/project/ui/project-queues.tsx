import { ArrowRight, Bot, CheckCircle2, FileCheck2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SectionHeader } from '@/shared/ui/SectionHeader'
import { StatusBadge } from '@/entities/execution-node/ui/StatusBadge'
import { currentContractIDs, isAcceptedRecord, isReadyToProgress, isReviewInProgress, isSealedRecord, needsReviewDecision } from '@/entities/execution-node/model/selectors'
import type { CompletionRecord, ExecutionBranch, ExecutionContract } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import { recordDate } from './project-shared'

type QueueListProps = {
  title: string
  eyebrow: string
  count: number
  icon: LucideIcon
  children: ReactNode
  empty: string
}

export function ProjectQueues({ project, contracts, activeBranchContracts }: { project: Project; contracts: ExecutionContract[]; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }> }) {
  const currentContractUuids = currentContractIDs([project], activeBranchContracts.map(({ branch }) => branch))
  const currentContracts = contracts.filter((contract) => currentContractUuids.has(contract.uuid))
  const pendingProgress = currentContracts.filter((contract) => !contract.completionRecordUuid && isReadyToProgress(contract))
  const awaitingConfirmation = currentContracts.filter((contract) => !contract.completionRecordUuid && needsReviewDecision(contract))
  const reviewing = currentContracts.filter((contract) => !contract.completionRecordUuid && isReviewInProgress(contract))

  return (
    <section className="space-y-5 border-y border-rail py-8" aria-labelledby="project-queues-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">项目工作区</div>
          <h2 id="project-queues-title" className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">按下一步处理</h2>
        </div>
        <span className="text-sm font-semibold text-graphite">{pendingProgress.length + awaitingConfirmation.length + reviewing.length} 个当前待处理节点</span>
      </div>

      <div className="divide-y divide-rail border-y border-rail bg-surface">
        {awaitingConfirmation.length > 0 ? <QueueList title="等待你的确认" eyebrow="Your decision" count={awaitingConfirmation.length} icon={CheckCircle2} empty="">
          {awaitingConfirmation.map((contract) => <QueueNodeRow key={contract.uuid} contract={contract} mode="confirmation" />)}
        </QueueList> : null}
        {reviewing.length > 0 ? <QueueList title="AI 正在审核" eyebrow="AI review" count={reviewing.length} icon={Bot} empty="">
          {reviewing.map((contract) => <QueueNodeRow key={contract.uuid} contract={contract} mode="reviewing" />)}
        </QueueList> : null}
        {pendingProgress.length > 0 ? <QueueList title="等待推进" eyebrow="Next action" count={pendingProgress.length} icon={FileCheck2} empty="">
          {pendingProgress.map((contract) => <QueueNodeRow key={contract.uuid} contract={contract} mode="pending" />)}
        </QueueList> : null}
        {pendingProgress.length + awaitingConfirmation.length + reviewing.length === 0 ? <p className="px-5 py-4 text-sm text-graphite">当前没有需要处理的行动。</p> : null}
      </div>
    </section>
  )
}

function QueueList({ title, eyebrow, count, icon: Icon, children, empty }: QueueListProps) {
  return (
    <section className="min-w-0" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-rail px-4 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0 text-signal" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase text-signal">{eyebrow}</div>
            <h3 className="mt-1 truncate text-base font-semibold text-ink">{title}</h3>
          </div>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-graphite">{count}</span>
      </div>
      <div className="divide-y divide-rail">
        {count > 0 ? children : <div className="px-4 py-5 text-sm leading-6 text-graphite">{empty}</div>}
      </div>
    </section>
  )
}

function QueueNodeRow({ contract, mode }: { contract: ExecutionContract; mode: 'pending' | 'confirmation' | 'reviewing' }) {
  const reviewHint = mode === 'reviewing'
    ? '已提交行动记录 · 等待 AI 整理'
    : mode === 'confirmation'
      ? contract.aiReview?.verdict === 'pass' ? '记录较完整 · 等待你确认' : '记录仍有缺口 · 等待你处理'
      : '打开节点记录这次行动'
  return (
    <Link to={`/contracts/${contract.uuid}`} className="group grid gap-3 px-4 py-4 transition hover:bg-shell focus:outline-none focus-visible:shadow-focusline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{contract.title}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-graphite">{contract.verifiableGoal}</span>
        <span className={`mt-2 block text-xs font-semibold ${mode === 'confirmation' && contract.aiReview?.verdict !== 'pass' ? 'text-clay' : 'text-signal'}`}>{reviewHint}</span>
      </span>
      <span className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        {mode === 'reviewing' ? <span className="font-mono text-[11px] font-semibold text-signal">审核中</span> : <StatusBadge stage={contract.stage} />}
        <ArrowRight size={16} className="text-graphite transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
      </span>
    </Link>
  )
}

export function ProjectRecords({ records, contracts }: { records: CompletionRecord[]; contracts: ExecutionContract[] }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader eyebrow="Project records" title="项目记录" />
        <span className="text-sm font-semibold text-graphite">{records.filter(isAcceptedRecord).length} 条已验收 · {records.filter(isSealedRecord).length} 条已封存</span>
      </div>
      {records.length > 0 ? (
        <div className="border-y border-rail bg-surface">
          {records.slice().reverse().map((record) => {
            const isAccepted = isAcceptedRecord(record)
            const closingNode = contracts.find((contract) => contract.uuid === record.closingContractUuid)
            return (
              <Link key={record.uuid} to={`/contracts/${record.closingContractUuid}?tab=completion`} className="group grid gap-4 border-b border-rail px-5 py-5 last:border-b-0 transition hover:bg-shell/45 focus:outline-none focus-visible:shadow-focusline lg:grid-cols-[104px_minmax(0,1fr)_240px_auto] lg:items-start">
                <div className={`border-l-2 pl-3 font-mono text-xs font-semibold ${isAccepted ? 'border-moss text-moss' : 'border-graphite text-graphite'}`}>
                  {recordDate(record)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink group-hover:text-signal">{record.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">{record.summary}</p>
                </div>
                <div className="text-xs leading-5 text-graphite">
                  <div className="font-semibold text-ink">覆盖 {record.coveredContractUuids.length} 个推进节点</div>
                  <div className={`mt-1 font-semibold ${isAccepted ? 'text-moss' : 'text-graphite'}`}>{isAccepted ? '行动记录 · 用户确认' : '记录有缺口 · 已保存'}</div>
                  <div className="mt-1 truncate">收束节点：{closingNode?.title ?? '推进节点'}</div>
                </div>
                <ArrowRight size={17} className="mt-1 shrink-0 text-signal transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      ) : <div className="border-l-2 border-rail py-3 pl-5 text-sm leading-6 text-graphite">通过验收或封存一次行动后，记录会出现在这里。</div>}
    </section>
  )
}

