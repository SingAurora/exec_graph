import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isAcceptedRecord } from '@/entities/execution-node/model/selectors'
import type { ExecutionBranch, ExecutionContract } from '@/entities/execution-node/model/types'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import { ProjectProfileSettings } from './project-settings'
import { ArchivedProjectNotice, ProjectArchiveBadge, ProjectTypeBadge, ProjectVisibilityBadge } from './project-badges'
import { ContributionHandoff, ContributionOriginBanner, ProjectAISettings } from './project-ai'
import { ProjectGraphTab, ProjectTabs } from './project-overview'
import { ProjectQueues, ProjectRecords } from './project-queues'
import { ConvergenceGate, ProjectCollaborationPublisher, ProjectWorkstation } from './project-actions'
import { projectTabFrom } from './project-shared'

export function ProjectPage() {
  const { projectUuid = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const project = useExecStore((state) => state.projects.find((item) => item.uuid === projectUuid))
  const allContracts = useExecStore((state) => state.contracts)
  const allCompletionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const updateProjectProfile = useExecStore((state) => state.updateProjectProfile)
  const archiveProject = useExecStore((state) => state.archiveProject)
  const restoreArchivedProject = useExecStore((state) => state.restoreArchivedProject)
  const deleteProject = useExecStore((state) => state.deleteProject)
  const setProjectSmartContract = useExecStore((state) => state.setProjectSmartContract)
  const accessToken = useExecStore((state) => state.accessToken)
  const refreshWorkspace = useExecStore((state) => state.refreshWorkspace)
  const contracts = useMemo(() => allContracts.filter((contract) => contract.projectUuid === projectUuid), [allContracts, projectUuid])
  const completionRecords = useMemo(() => allCompletionRecords.filter((record) => record.projectUuid === projectUuid), [allCompletionRecords, projectUuid])
  const branches = useMemo(() => allBranches.filter((branch) => branch.projectUuid === projectUuid), [allBranches, projectUuid])

  if (!project) {
    return <div className="rounded-md border border-rail bg-surface/72 p-6"><h1 className="font-display text-3xl font-semibold">项目不存在</h1><Link className="mt-4 inline-block text-sm font-semibold text-signal" to="/">返回我的项目</Link></div>
  }

  const isArchived = Boolean(project.archivedAt)
  const unlockedContracts = contracts.filter((contract) => !contract.completionRecordUuid)
  const sortedCompletionRecords = completionRecords.slice().sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  const currentContract = contracts.find((contract) => contract.uuid === project.currentContractUuid)
  const requestedParent = contracts.find((contract) => contract.uuid === (searchParams.get('parent') ?? undefined) && contract.stage === 'completed')
  const requestedClosure = contracts.find((contract) => contract.uuid === (searchParams.get('close') ?? undefined) && contract.stage === 'frozen')
  const requestedSupplement = contracts.find((contract) => contract.uuid === (searchParams.get('supplement') ?? undefined) && contract.stage === 'needs_supplement')
  const requestedRetry = contracts.find((contract) => contract.uuid === (searchParams.get('retry') ?? undefined) && contract.stage === 'sealed')
  const isFork = searchParams.get('fork') === '1'
  const requestedBranch = branches.find((branch) => branch.uuid === (searchParams.get('branch') ?? requestedClosure?.branchUuid ?? requestedSupplement?.branchUuid))
  const activeBranchContracts = branches.map((branch) => ({ branch, contract: contracts.find((contract) => contract.uuid === branch.currentContractUuid) })).filter((item): item is { branch: ExecutionBranch; contract: ExecutionContract } => Boolean(item.contract))
  const publishableCollaborationNodes = [currentContract, ...activeBranchContracts.map((item) => item.contract)].filter((contract): contract is ExecutionContract => Boolean(contract && contract.stage === 'frozen')).filter((contract, index, list) => list.findIndex((item) => item.uuid === contract.uuid) === index)
  const mergeSources = branches.map((branch) => contracts.find((contract) => contract.uuid === branch.headContractUuid && contract.stage === 'completed' && contract.completionRecordUuid)).filter((contract): contract is ExecutionContract => Boolean(contract)).filter((contract, index, list) => list.findIndex((item) => item.uuid === contract.uuid) === index)
  const latestRecord = sortedCompletionRecords.filter(isAcceptedRecord).at(-1)
  const latestCompleted = latestRecord ? contracts.find((contract) => contract.uuid === latestRecord.closingContractUuid) : undefined
  const activeTab = requestedParent || requestedClosure || requestedSupplement || requestedRetry ? 'nodes' : projectTabFrom(searchParams.get('tab'))

  return (
    <div className="space-y-9">
      <section className="grid gap-6 border-b border-rail pb-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div><div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-signal">项目 <ProjectVisibilityBadge visibility={project.visibility} /><ProjectTypeBadge projectType={project.projectType} />{isArchived ? <ProjectArchiveBadge /> : null}</div><h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">{project.title}</h1>{project.description ? <p className="mt-3 max-w-3xl text-base leading-7 text-graphite">{project.description}</p> : null}<div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-graphite"><span>{completionRecords.filter(isAcceptedRecord).length} 条已验收成果</span><span>{unlockedContracts.length} 个未闭合行动</span>{branches.length > 0 ? <span>{branches.length} 条行为路径</span> : null}</div></div>
        <div className="border-l-2 border-ink bg-shell p-5">{project.projectType === 'guided' ? <><div className="font-mono text-xs font-semibold uppercase text-signal">项目规则</div><div className="mt-3 text-lg font-semibold text-ink">AI 根据规则整理行动</div><p className="mt-2 line-clamp-4 text-sm leading-6 text-graphite">{project.projectRules}</p></> : <><div className="font-mono text-xs font-semibold uppercase text-signal">自主推进</div><div className="mt-3 text-lg font-semibold text-ink">下一步由你决定</div><p className="mt-2 text-sm leading-6 text-graphite">每次行动都可以请 AI 帮忙整理记录；现实状态由你确认，后续行动由你决定。</p></>}</div>
      </section>
      <ProjectTabs project={project} activeTab={activeTab} />
      {project.contributionOrigin ? <ContributionOriginBanner origin={project.contributionOrigin} /> : null}
      {activeTab === 'nodes' ? <>{isArchived ? <ArchivedProjectNotice /> : <ProjectWorkstation project={project} contracts={contracts} currentContract={currentContract} activeBranchContracts={activeBranchContracts} latestCompleted={latestCompleted} requestedParent={requestedParent} requestedClosure={requestedClosure} requestedSupplement={requestedSupplement} requestedRetry={requestedRetry} requestedBranch={requestedBranch} isFork={isFork} />}{project.visibility === 'public' ? publishableCollaborationNodes.map((node) => <ProjectCollaborationPublisher key={node.uuid} projectUuid={project.uuid} node={node} accessToken={accessToken} />) : null}<ProjectQueues project={project} contracts={contracts} activeBranchContracts={activeBranchContracts} />{branches.length > 1 ? <ConvergenceGate project={project} branches={branches} sources={mergeSources} /> : null}</> : null}
      {activeTab === 'records' ? <>{project.contributionOrigin ? <ContributionHandoff origin={project.contributionOrigin} records={completionRecords.filter(isAcceptedRecord)} token={accessToken} /> : null}<ProjectRecords records={sortedCompletionRecords} contracts={contracts} /></> : null}
      {activeTab === 'graph' ? <ProjectGraphTab project={project} contracts={contracts} branches={branches} /> : null}
      {activeTab === 'profile' ? <ProjectProfileSettings project={project} isArchived={isArchived} onUpdateProjectProfile={(input) => updateProjectProfile(project.uuid, input)} onSetProjectSmartContract={(smartContractUuid) => setProjectSmartContract(project.uuid, smartContractUuid)} onArchiveProject={() => archiveProject(project.uuid)} onRestoreArchivedProject={() => restoreArchivedProject(project.uuid)} onDeleteProject={async () => { const result = await deleteProject(project.uuid); if (result.success) navigate('/') }} /> : null}
      {activeTab === 'ai' ? <ProjectAISettings project={project} accessToken={accessToken} isArchived={isArchived} onUpdated={refreshWorkspace} /> : null}
    </div>
  )
}
