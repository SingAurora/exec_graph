import { Link } from 'react-router-dom'
import type { ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import { StatusBadge } from '@/entities/execution-node/ui/StatusBadge'

type RelayRailProps = {
  node: ExecutionContract
  contracts: ExecutionContract[]
  edges: ExecutionEdge[]
}

/** 展示节点的来源、当前行动与可接续行动，不读取任何全局状态。 */
export function RelayRail({ node, contracts, edges }: RelayRailProps) {
  const sourceIds = node.sourceContractUuids?.length ? node.sourceContractUuids : node.parentContractUuid ? [node.parentContractUuid] : node.retryOfContractUuid ? [node.retryOfContractUuid] : []
  const sources = sourceIds.map((sourceId) => contracts.find((item) => item.uuid === sourceId)).filter((item): item is ExecutionContract => Boolean(item))
  const children = contracts.filter((item) => item.parentContractUuid === node.uuid)
  const supplement = contracts.find((item) => item.supplementOfContractUuid === node.uuid)
  const closure = edges
    .filter((edge) => edge.sourceContractUuid === node.uuid && edge.type === 'closure')
    .map((edge) => contracts.find((item) => item.uuid === edge.targetContractUuid))
    .filter((item): item is ExecutionContract => Boolean(item))
  const isClosureNode = edges.some((edge) => edge.targetContractUuid === node.uuid && edge.type === 'closure')
  const followUps = supplement ? [supplement] : closure.length > 0 ? closure : children

  return (
    <div className="border-y border-rail bg-shell/55 px-5 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <SourceStop sources={sources} closure={isClosureNode} retry={Boolean(node.retryOfContractUuid)} />
        <RailConnector />
        <RailStop label="当前行为" contract={node} current />
        <RailConnector />
        <FollowUpStop label={supplement ? '补足行为' : closure.length > 0 ? '收束节点' : '后续行为'} contracts={followUps} />
      </div>
    </div>
  )
}

function FollowUpStop({ label, contracts }: { label: string; contracts: ExecutionContract[] }) {
  return (
    <div className="flex h-full min-h-24 flex-col border-l border-rail pl-4">
      <div className="font-mono text-xs font-semibold text-signal">{label}</div>
      {contracts.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {contracts.map((contract) => (
            <Link key={contract.uuid} to={`/contracts/${contract.uuid}`} className="truncate text-sm font-semibold text-ink hover:text-signal focus:outline-none focus-visible:shadow-focusline">
              {contract.title}
            </Link>
          ))}
        </div>
      ) : <div className="mt-3 text-sm font-semibold leading-5 text-graphite">暂无后续行为</div>}
    </div>
  )
}

function SourceStop({ sources, closure, retry }: { sources: ExecutionContract[]; closure: boolean; retry: boolean }) {
  return (
    <div className="flex h-full min-h-24 flex-col border-l border-rail pl-4">
      <div className="font-mono text-xs font-semibold text-signal">{retry ? '上次尝试' : closure ? '待收束节点' : sources.length > 1 ? '合并来源' : '依据记录'}</div>
      {sources.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {sources.map((source) => (
            <Link key={source.uuid} to={`/contracts/${source.uuid}`} className="truncate text-sm font-semibold text-ink hover:text-signal focus:outline-none focus-visible:shadow-focusline">
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
        'flex h-full min-h-24 flex-col border-l pl-4',
        current ? 'border-l-2 border-signal text-ink' : 'border-rail text-ink',
      ].join(' ')}
    >
      <div className="font-mono text-xs font-semibold text-signal">
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
    <Link to={`/contracts/${contract.uuid}`} className="rounded-md focus:outline-none focus-visible:shadow-focusline">
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
