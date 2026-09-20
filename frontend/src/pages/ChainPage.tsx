import { Eye, GitBranch, GitFork, LockKeyhole, Network } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProjectGraph } from '@/widgets/project/ui/ProjectGraph'
import { StatusBadge } from '@/entities/execution-node/ui/StatusBadge'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import type { ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'

type LinkedContract = { contract: ExecutionContract; edgeType?: ExecutionEdge['type'] }

const pathToTip = (tip: ExecutionContract | undefined, contracts: ExecutionContract[], branchUuid?: string) => {
  if (!tip) return []
  const byId = new Map(contracts.map((contract) => [contract.uuid, contract]))
  const path: ExecutionContract[] = []
  let node: ExecutionContract | undefined = tip
  while (node) {
    if (branchUuid && node.branchUuid !== branchUuid) break
    path.unshift(node)
    node = node.parentContractUuid ? byId.get(node.parentContractUuid) : undefined
  }
  return path
}

export function ChainPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projects = useExecStore((state) => state.projects)
  const allContracts = useExecStore((state) => state.contracts)
  const allBranches = useExecStore((state) => state.branches)
  const allEdges = useExecStore((state) => state.edges)
  const initialProject = projects.find((project) => !project.archivedAt) ?? projects[0]
  const project = projects.find((item) => item.uuid === searchParams.get('project')) ?? initialProject
  const contracts = useMemo(() => allContracts.filter((contract) => contract.projectUuid === project?.uuid), [allContracts, project?.uuid])
  const isPublic = project?.visibility === 'public'
  const branches = useMemo(() => allBranches.filter((branch) => branch.projectUuid === project?.uuid), [allBranches, project?.uuid])
  const selectedBranch = isPublic
    ? branches.find((branch) => branch.uuid === searchParams.get('branch')) ?? branches.find((branch) => branch.currentContractUuid) ?? branches[0]
    : undefined
  const privateCurrent = contracts.find((contract) => contract.uuid === project?.currentContractUuid)
  const privateLatestCompleted = [...contracts].filter((contract) => contract.stage === 'completed').sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
  const visibleContracts = isPublic
    ? pathToTip(contracts.find((contract) => contract.uuid === selectedBranch?.headContractUuid), contracts, selectedBranch?.uuid)
    : pathToTip(privateCurrent ?? privateLatestCompleted, contracts)
  const visibleIds = useMemo(() => new Set(visibleContracts.map((contract) => contract.uuid)), [visibleContracts])
  const edges = useMemo(
    () => allEdges.filter((edge) => visibleIds.has(edge.sourceContractUuid) && visibleIds.has(edge.targetContractUuid) && ['lineage', 'fork', 'supplement', 'closure'].includes(edge.type)),
    [allEdges, visibleIds],
  )
  const childrenBySource = useMemo(() => {
    const byId = new Map(visibleContracts.map((contract) => [contract.uuid, contract]))
    const children = new Map<string, LinkedContract[]>()
    for (const edge of edges) {
      const target = byId.get(edge.targetContractUuid)
      if (target) children.set(edge.sourceContractUuid, [...(children.get(edge.sourceContractUuid) ?? []), { contract: target, edgeType: edge.type }])
    }
    return children
  }, [edges, visibleContracts])
  const roots = useMemo(() => {
    const targetIds = new Set(edges.map((edge) => edge.targetContractUuid))
    return visibleContracts.filter((contract) => !targetIds.has(contract.uuid))
  }, [edges, visibleContracts])

  if (!project) return null

  const hiddenHistoryCount = contracts.length - visibleContracts.length
  const setProject = (nextProjectId: string) => setSearchParams({ project: nextProjectId })
  const setBranch = (branchUuid: string) => setSearchParams({ project: project.uuid, branch: branchUuid })

  return (
    <div className="space-y-8">
      <section className="grid gap-6 border-b border-rail pb-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">{isPublic ? <Eye size={15} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}{isPublic ? '公开分支' : '私人主线'}</div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">节点链</h1>
        </div>
        <div className="grid h-fit gap-3 self-end">
          <label className="grid gap-2"><span className="text-sm font-semibold text-ink">查看项目</span><select value={project.uuid} onChange={(event) => setProject(event.target.value)} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">{projects.map((item) => <option key={item.uuid} value={item.uuid}>{item.title}</option>)}</select></label>
          {isPublic && branches.length > 0 ? <label className="grid gap-2"><span className="text-sm font-semibold text-ink">查看分支</span><select value={selectedBranch?.uuid ?? ''} onChange={(event) => setBranch(event.target.value)} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">{branches.map((branch) => <option key={branch.uuid} value={branch.uuid}>{branch.title}{branch.currentContractUuid ? ' · 处理中' : ' · 已闭合'}</option>)}</select></label> : null}
          <Link to={`/projects/${project.uuid}`} className="text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">打开项目工作台</Link>
        </div>
      </section>

      {isPublic && selectedBranch ? <BranchContext branch={selectedBranch} contracts={contracts} /> : null}

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={16} aria-hidden="true" />{isPublic ? selectedBranch?.title : project.title}</div>
          {visibleContracts.length > 0 ? <ProjectGraph projectUuid={project.uuid} visibleContractIds={visibleContracts.map((contract) => contract.uuid)} heightClassName="h-[620px] min-h-[420px]" /> : <div className="border-l-2 border-moss py-2 pl-4 text-sm leading-6 text-graphite">这里还没有可展示的节点。冻结第一条节点后，它会成为这条链的起点。</div>}
        </div>
        <aside className="border-t border-rail pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><GitBranch size={16} aria-hidden="true" />{isPublic ? '分支记录' : '主线记录'}</div>
          {roots.length > 0 ? <ul className="mt-4 space-y-3">{roots.map((root) => <ChainTree key={root.uuid} node={root} childrenBySource={childrenBySource} />)}</ul> : <p className="mt-4 text-sm leading-6 text-graphite">节点关系将在这里按来源展开。</p>}
          {hiddenHistoryCount > 0 ? <p className="mt-6 border-l-2 border-rail pl-3 text-xs leading-5 text-graphite">另有 {hiddenHistoryCount} 条不属于当前{isPublic ? '分支' : '主线'}的历史记录，已从此视图收起。</p> : null}
        </aside>
      </section>
    </div>
  )
}

function BranchContext({ branch, contracts }: { branch: ExecutionBranch; contracts: ExecutionContract[] }) {
  const source = contracts.find((contract) => contract.uuid === branch.forkedFromContractUuid)
  return <section className="border-l-2 border-signal py-1 pl-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><GitFork size={15} aria-hidden="true" />分支上下文</div><p className="mt-2 text-sm leading-6 text-graphite">{source ? <>此分支从「<Link to={`/contracts/${source.uuid}`} className="font-semibold text-signal hover:text-ink">{source.title}</Link>」的签名完成记录分叉。</> : '这是公开项目中的一条独立执行分支。'}</p></section>
}

function ChainTree({ node, edgeType, childrenBySource }: { node: ExecutionContract; edgeType?: ExecutionEdge['type']; childrenBySource: Map<string, LinkedContract[]> }) {
  const children = childrenBySource.get(node.uuid) ?? []
  const relation = edgeType === 'closure' ? '收束' : edgeType === 'supplement' ? '补充' : edgeType === 'fork' ? '分叉' : edgeType === 'lineage' ? '接续' : undefined
  return <li><Link to={`/contracts/${node.uuid}`} className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-2 transition hover:bg-shell/72 focus:outline-none focus-visible:shadow-focusline"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{node.title}</span>{relation ? <span className="font-mono text-[11px] font-semibold text-signal">{relation}</span> : null}<StatusBadge stage={node.stage} /></Link>{children.length > 0 ? <ul className="ml-3 border-l border-rail pl-3">{children.map((child) => <ChainTree key={`${node.uuid}-${child.contract.uuid}`} node={child.contract} edgeType={child.edgeType} childrenBySource={childrenBySource} />)}</ul> : null}</li>
}
