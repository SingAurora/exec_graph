import { Link } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'
import type { ExecutionContract } from '../types'
import { StatusBadge } from './StatusBadge'

export function RelayRail({ node }: { node: ExecutionContract }) {
  const contracts = useExecStore((state) => state.contracts)
  const sourceIds = node.sourceContractIds ?? (node.parentContractId ? [node.parentContractId] : [])
  const sources = sourceIds.map((sourceId) => contracts.find((item) => item.id === sourceId)).filter((item): item is ExecutionContract => Boolean(item))
  const children = contracts.filter((item) => item.parentContractId === node.id)
  const supplement = contracts.find((item) => item.supplementOfContractId === node.id)
  const followUps = supplement ? [supplement] : children

  return (
    <div className="rounded-md border border-rail bg-[#efebe1] p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <SourceStop sources={sources} />
        <RailConnector />
        <RailStop label="当前行为" contract={node} current />
        <RailConnector />
        <FollowUpStop label={supplement ? '补足行为' : '后续行为'} contracts={followUps} />
      </div>
    </div>
  )
}

function FollowUpStop({ label, contracts }: { label: string; contracts: ExecutionContract[] }) {
  return (
    <div className="flex h-full min-h-28 flex-col rounded-md border border-rail bg-paper p-4">
      <div className="font-mono text-xs font-semibold text-signal">{label}</div>
      {contracts.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {contracts.map((contract) => (
            <Link key={contract.id} to={`/contracts/${contract.id}`} className="truncate text-sm font-semibold text-ink hover:text-signal focus:outline-none focus-visible:shadow-focusline">
              {contract.title}
            </Link>
          ))}
        </div>
      ) : <div className="mt-3 text-sm font-semibold leading-5 text-graphite">暂无后续行为</div>}
    </div>
  )
}

function SourceStop({ sources }: { sources: ExecutionContract[] }) {
  return (
    <div className="flex h-full min-h-28 flex-col rounded-md border border-rail bg-paper p-4">
      <div className="font-mono text-xs font-semibold text-signal">{sources.length > 1 ? '合并来源' : '依据记录'}</div>
      {sources.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {sources.map((source) => (
            <Link key={source.id} to={`/contracts/${source.id}`} className="truncate text-sm font-semibold text-ink hover:text-signal focus:outline-none focus-visible:shadow-focusline">
              {source.title}
            </Link>
          ))}
        </div>
      ) : <div className="mt-3 text-sm font-semibold leading-5 text-graphite">项目起点</div>}
    </div>
  )
}

function RailStop({
  label,
  contract,
  empty,
  current,
}: {
  label: string
  contract?: ExecutionContract
  empty?: string
  current?: boolean
}) {
  const content = (
    <div
      className={[
        'flex h-full min-h-28 flex-col rounded-md border p-4',
        current ? 'border-ink bg-ink text-paper' : 'border-rail bg-paper text-ink',
      ].join(' ')}
    >
      <div className={current ? 'font-mono text-xs font-semibold text-paper/70' : 'font-mono text-xs font-semibold text-signal'}>
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold leading-5">{contract?.title ?? empty}</div>
      {contract ? (
        <div className="mt-auto pt-4">
          <StatusBadge stage={contract.stage} />
        </div>
      ) : null}
    </div>
  )

  return contract && !current ? (
    <Link to={`/contracts/${contract.id}`} className="rounded-md focus:outline-none focus-visible:shadow-focusline">
      {content}
    </Link>
  ) : (
    content
  )
}

function RailConnector() {
  return (
    <div className="hidden w-10 items-center justify-center md:flex">
      <div className="h-px w-full bg-graphite/40" />
    </div>
  )
}
