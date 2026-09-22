import { GitBranch, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import type { DraftReview } from '@/entities/execution-node/model/types'
import { PlanningConversation } from '@/features/conversation/ui/ActionConversation'

type ContractComposerProps = {
  projectUuid?: string
  lockProject?: boolean
  parentContractUuid?: string
  sourceContractUuids?: string[]
  branchUuid?: string
  fork?: boolean
  closureSourceUuids?: string[]
  supplementOfContractUuid?: string
  retryOfContractUuid?: string
}

export function ContractComposer({ projectUuid, lockProject = false, parentContractUuid, sourceContractUuids, branchUuid, fork = false, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid }: ContractComposerProps) {
  const projects = useExecStore((state) => state.projects)
  const parentContract = useExecStore((state) => state.contracts.find((contract) => contract.uuid === parentContractUuid))
  const smartContracts = useExecStore((state) => state.smartContracts)
  const contracts = useExecStore((state) => state.contracts)
  const createExecutionNode = useExecStore((state) => state.createExecutionNode)
  const [selectedProjectID, setSelectedProjectID] = useState(projectUuid ?? '')
  const selectedProject = projects.find((project) => project.uuid === selectedProjectID)
  const isFirstNode = Boolean(selectedProject) && contracts.every((contract) => contract.projectUuid !== selectedProject?.uuid) && !parentContractUuid && !(sourceContractUuids && sourceContractUuids.length > 0)
  const activeRevision = selectedProject?.contractRevisions.find(
    (revision) => revision.uuid === selectedProject.activeContractRevisionUuid,
  )
  const selectedContract = smartContracts.find((contract) => contract.uuid === activeRevision?.smartContractUuid)
  const isClosure = Boolean(parentContractUuid && closureSourceUuids?.includes(parentContractUuid))

  const onCreate = async ({ draft, draftReview, planningConversationUuid }: { draft: string; draftReview: DraftReview; planningConversationUuid: string }) => createExecutionNode({ projectUuid: selectedProject!.uuid, draft, parentContractUuid, sourceContractUuids, branchUuid, fork, closureSourceUuids, supplementOfContractUuid, retryOfContractUuid, draftReview, planningConversationUuid })

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
        <LockKeyhole size={15} aria-hidden="true" />
        {isFirstNode ? 'First action' : 'New action'}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{isFirstNode ? '创建第一项推进' : retryOfContractUuid ? '根据上次经验重新尝试' : supplementOfContractUuid ? '开始补足行动' : isClosure ? '创建补齐并收束节点' : '开始一项推进'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">先和 AI 把本次行动收敛为清楚的目标、做到位清单和记录要求，再保存到行动路径。</p>

      <div className="mt-5 grid gap-4">
        {lockProject && selectedProject ? (
          <div className="flex items-center justify-between gap-3 border-b border-rail pb-3">
            <span className="text-sm font-semibold text-ink">归属项目</span>
            <span className="text-sm font-semibold text-signal">{selectedProject.title}</span>
          </div>
        ) : (
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">归属项目</span>
            <select
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
              value={selectedProjectID}
              onChange={(event) => setSelectedProjectID(event.target.value)}
            >
              <option value="">选择一个项目</option>
              {projects.filter((project) => !project.archivedAt).map((project) => (
                <option key={project.uuid} value={project.uuid}>
                  {project.title}
                </option>
              ))}
            </select>
            {!selectedProject ? <span className="text-xs font-semibold text-clay">请选择项目后再开始行动。</span> : null}
          </label>
        )}

        {selectedProject && selectedContract && activeRevision ? (
          <div className="rounded-md border border-rail bg-paper p-4">
            <div className="font-mono text-xs font-semibold text-signal">
              当前项目合约
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{selectedContract.name}</div>
            <p className="mt-2 text-sm leading-6 text-graphite">{selectedContract.description}</p>
            <div className="mt-3 flex items-start gap-2 border-t border-rail pt-3 text-xs leading-5 text-graphite">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
              新行为只能使用当前项目合约；要调整审查规则，需要进入项目设置修改合约。
            </div>
          </div>
        ) : null}

        {sourceContractUuids && sourceContractUuids.length > 1 ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-3 grid gap-2">
              {sourceContractUuids.map((sourceId) => {
                const source = contracts.find((contract) => contract.uuid === sourceId)
                return source ? <div key={source.uuid} className="text-sm font-semibold text-ink">{source.title}</div> : null
              })}
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">这是一项普通推进，只是同时引用多条已经锁定的完成记录。提交结果后，智能合约仍按本节点的规则审查。</p>
          </div>
        ) : null}

        {!(sourceContractUuids && sourceContractUuids.length > 1) && parentContract ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{parentContract.title}</div>
            <p className="mt-1 text-sm leading-6 text-graphite">
              {closureSourceUuids?.includes(parentContract.uuid) ? '本节点完成时会与这项未闭合推进一起接受审查并收束。' : fork ? '这项行为会从这条完成记录拆出一条独立路径。' : '这项行为会从这条完成记录继续。'}
            </p>
          </div>
        ) : null}

        {selectedProject ? <PlanningConversation projectUuid={selectedProject.uuid} parentContractUuid={parentContractUuid} sourceContractUuids={sourceContractUuids} branchUuid={branchUuid} fork={fork} closureSourceUuids={closureSourceUuids} supplementOfContractUuid={supplementOfContractUuid} retryOfContractUuid={retryOfContractUuid} onCreate={onCreate} /> : null}
      </div>
    </section>
  )
}
