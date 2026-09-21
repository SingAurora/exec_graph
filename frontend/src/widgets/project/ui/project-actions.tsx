import { ArrowRight, GitBranchPlus, GitFork, GitMerge, LockKeyhole, UsersRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ContractComposer } from '@/features/project/ui/ContractComposer'
import { publishCollaborationCall } from '@/entities/project/api/client'
import type { ExecutionBranch, ExecutionContract } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import { StatusBadge } from '@/entities/execution-node/ui/StatusBadge'
import { currentNodeCopy } from './project-shared'

export function ProjectWorkstation({ project, contracts, currentContract, activeBranchContracts, latestCompleted, requestedParent, requestedClosure, requestedSupplement, requestedRetry, requestedBranch, isFork }: { project: Project; contracts: ExecutionContract[]; currentContract?: ExecutionContract; activeBranchContracts: Array<{ branch: ExecutionBranch; contract: ExecutionContract }>; latestCompleted?: ExecutionContract; requestedParent?: ExecutionContract; requestedClosure?: ExecutionContract; requestedSupplement?: ExecutionContract; requestedRetry?: ExecutionContract; requestedBranch?: ExecutionBranch; isFork: boolean }) {
  const activeActions = [
    ...(currentContract ? [{ branch: undefined, contract: currentContract }] : []),
    ...activeBranchContracts,
  ]
  if (requestedParent) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={isFork ? GitFork : ArrowRight} title={isFork ? `从「${requestedParent.title}」拆分新路径` : `从「${requestedParent.title}」继续下一项`} />
        <ContractComposer projectUuid={project.uuid} lockProject parentContractUuid={requestedParent.uuid} branchUuid={requestedBranch?.uuid} fork={isFork} />
      </section>
    )
  }

  if (requestedClosure) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitMerge} title={`补齐并收束「${requestedClosure.title}」`} />
        <ContractComposer projectUuid={project.uuid} lockProject parentContractUuid={requestedClosure.uuid} sourceContractUuids={[requestedClosure.uuid]} closureSourceUuids={[requestedClosure.uuid]} branchUuid={requestedBranch?.uuid} />
      </section>
    )
  }

  if (requestedSupplement) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitBranchPlus} title={`补足「${requestedSupplement.title}」中的缺口`} />
        <ContractComposer projectUuid={project.uuid} lockProject parentContractUuid={requestedSupplement.uuid} sourceContractUuids={[requestedSupplement.uuid]} supplementOfContractUuid={requestedSupplement.uuid} branchUuid={requestedBranch?.uuid} />
      </section>
    )
  }

  if (requestedRetry) {
    return (
      <section id="new-node" className="space-y-6 border-y border-rail py-8">
        <FlowIntroduction icon={GitBranchPlus} title={`从「${requestedRetry.title}」的经验重新尝试`} />
        <ContractComposer projectUuid={project.uuid} lockProject retryOfContractUuid={requestedRetry.uuid} />
      </section>
    )
  }

  if (activeActions.length > 1 || activeBranchContracts.length > 0) {
    return (
      <section className="space-y-5 border-y border-rail py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-semibold uppercase text-signal">当前行为</div>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">每条路径保留一次推进</h2>
          </div>
          <span className="text-sm font-semibold text-graphite">{activeActions.length} 个行动节点</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {activeActions.map(({ branch, contract }) => <div key={contract.uuid} className="space-y-2"><div className="font-mono text-xs font-semibold text-signal">{branch?.title ?? '项目主线'}</div><CurrentActionCard contract={contract} /></div>)}
        </div>
      </section>
    )
  }

  if (currentContract) return <CurrentActionSection contract={currentContract} />

  if (contracts.length > 0 && latestCompleted) {
    return (
      <section className="space-y-6 border-y border-rail py-8">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">下一次推进</div>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">从最近完成记录继续</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-graphite">完成记录只锁定已经闭合的范围，下一项行动仍会作为新的节点加入链上。</p>
        </div>
        <ContractComposer projectUuid={project.uuid} lockProject parentContractUuid={latestCompleted.uuid} />
      </section>
    )
  }

  if (contracts.length > 0) {
    const latestSealed = contracts.filter((contract) => contract.stage === 'sealed').sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
    return (
      <section className="space-y-6 border-y border-rail py-8">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-graphite">调整方向</div>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">保留这次经验，再开始新的尝试</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-graphite">封存不会变成已验收成果，但 AI 会带入原目标、已提交证据和指出的缺口，帮助你调整下一步。</p>
        </div>
        {latestSealed ? <ContractComposer projectUuid={project.uuid} lockProject retryOfContractUuid={latestSealed.uuid} /> : <div className="border-l-2 border-graphite py-2 pl-4 text-sm leading-6 text-graphite">当前项目没有可接续的已验收行动。</div>}
      </section>
    )
  }

  return (
    <section id="new-node" className="space-y-6 border-y border-rail py-8">
      <FlowIntroduction icon={LockKeyhole} title="创建第一项推进" />
      <ContractComposer projectUuid={project.uuid} lockProject />
    </section>
  )
}

export function CurrentActionSection({ contract }: { contract: ExecutionContract }) {
  const copy = currentNodeCopy(contract)
  const Icon = copy.icon
  return (
    <section className="grid gap-6 border-y border-rail py-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={16} aria-hidden="true" />{copy.eyebrow}</div>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">{copy.title}</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-graphite">{copy.description}</p>
      </div>
      <CurrentActionCard contract={contract} />
    </section>
  )
}

export function ProjectCollaborationPublisher({ projectUuid, node, accessToken }: { projectUuid: string; node: ExecutionContract; accessToken: string }) {
  const [isPublishing, setIsPublishing] = useState(false)
	const [published, setPublished] = useState(false)
  const [message, setMessage] = useState('')
  const publish = async () => {
    setIsPublishing(true); setMessage('')
    try {
		await publishCollaborationCall(accessToken, projectUuid, node.uuid, node.title)
		setPublished(true)
      setMessage('开放缺口已发布，可以在协作探索中接收其他人的成果。')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '发布开放缺口失败。') }
    finally { setIsPublishing(false) }
  }
  return <section className="flex flex-wrap items-center justify-between gap-4 border-y border-rail py-5"><div><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><UsersRound size={15} />公开协作</div><p className="mt-2 text-sm leading-6 text-graphite">把这项冻结行动发布为开放缺口。贡献者只能提交自己的公开已验收成果，最终是否采纳仍由你确认。</p>{message ? <p className="mt-2 text-sm font-semibold text-signal">{message}</p> : null}</div><button type="button" disabled={isPublishing || published} onClick={publish} className="inline-flex h-10 shrink-0 items-center gap-2 border border-signal bg-surface px-3 text-sm font-semibold text-signal disabled:opacity-50"><UsersRound size={16} />{published ? '已发布' : '发布开放缺口'}</button></section>
}

export function CurrentActionCard({ contract }: { contract: ExecutionContract }) {
  const action = currentNodeCopy(contract)
  const Icon = action.icon
  const nextStep = contract.stage === 'frozen'
    ? '提交后等待 AI 审查，再决定是否继续补足'
    : contract.stage === 'verified'
      ? '确认验收后，这次行动会成为可接续成果'
      : '可以继续补足，或封存这次尚未验收的行动'
  return (
    <Link to={`/contracts/${contract.uuid}`} className="group block border-l-2 border-ink bg-surface/72 p-6 transition hover:bg-shell focus:outline-none focus-visible:shadow-focusline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={16} aria-hidden="true" />当前要处理</div>
        <StatusBadge stage={contract.stage} />
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold leading-tight text-ink">{contract.title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">{contract.verifiableGoal}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rail pt-4">
        <span className="text-sm leading-6 text-graphite">{nextStep}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">{action.actionLabel}<ArrowRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  )
}

export function ConvergenceGate({ project, branches, sources }: { project: Project; branches: ExecutionBranch[]; sources: ExecutionContract[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const canConverge = sources.length >= 2
  return (
    <section className="space-y-5 border-t border-rail pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><GitMerge size={16} aria-hidden="true" />路径汇合</div>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{sources.length} / {branches.length} 条路径已有锁定记录</h2>
        </div>
        {canConverge && !isOpen ? <button type="button" onClick={() => setIsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"><GitMerge size={16} aria-hidden="true" />开始汇合行动</button> : null}
      </div>
      {canConverge ? isOpen ? <ContractComposer projectUuid={project.uuid} lockProject sourceContractUuids={sources.map((source) => source.uuid)} /> : <p className="text-sm leading-6 text-graphite">把多条路径的完成记录作为依据，开始一个普通行动节点。这个节点提交的结果仍由同一份智能合约审查，必要时可以把前置推进一起锁定。</p> : <p className="text-sm leading-6 text-graphite">当多条路径都形成完成记录后，可以从它们开始一项汇合行动；当前仍有路径在推进。</p>}
    </section>
  )
}

export function FlowIntroduction({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="xl:pt-3"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={15} aria-hidden="true" />下一次推进</div><h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{title}</h2></div>
}


