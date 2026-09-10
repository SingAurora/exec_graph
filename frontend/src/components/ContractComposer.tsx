import { GitBranch, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useExecStore } from '../store/useExecStore'
import type { DraftReview } from '../types'
import { PlanningConversation } from './ActionConversation'

type ContractComposerProps = {
  projectId?: string
  lockProject?: boolean
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
  closureSourceIds?: string[]
  supplementOfContractId?: string
  retryOfContractId?: string
}

export function ContractComposer({ projectId, lockProject = false, parentContractId, sourceContractIds, branchId, fork = false, closureSourceIds, supplementOfContractId, retryOfContractId }: ContractComposerProps) {
  const projects = useExecStore((state) => state.projects)
  const parentContract = useExecStore((state) => state.contracts.find((contract) => contract.id === parentContractId))
  const smartContracts = useExecStore((state) => state.smartContracts)
  const contracts = useExecStore((state) => state.contracts)
  const createContract = useExecStore((state) => state.createContract)
  const defaultProject = projects.find((project) => project.isDefault) ?? projects[0]
  const [selectedProjectID, setSelectedProjectID] = useState(projectId ?? defaultProject?.id ?? '')
  const selectedProject = projects.find((project) => project.id === selectedProjectID) ?? defaultProject
  const isFirstNode = Boolean(selectedProject) && contracts.every((contract) => contract.projectId !== selectedProject?.id) && !parentContractId && !(sourceContractIds && sourceContractIds.length > 0)
  const activeRevision = selectedProject?.contractRevisions.find(
    (revision) => revision.id === selectedProject.activeContractRevisionId,
  )
  const selectedContract = smartContracts.find((contract) => contract.id === activeRevision?.smartContractId)
  const isClosure = Boolean(parentContractId && closureSourceIds?.includes(parentContractId))

  const onCreate = async ({ draft, draftReview, planningConversationId }: { draft: string; draftReview: DraftReview; planningConversationId: string }) => createContract({ projectId: selectedProject!.id, draft, parentContractId, sourceContractIds, branchId, fork, closureSourceIds, supplementOfContractId, retryOfContractId, draftReview, planningConversationId })

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
        <LockKeyhole size={15} aria-hidden="true" />
        {isFirstNode ? 'First action' : 'New action'}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{isFirstNode ? '创建第一项推进' : retryOfContractId ? '根据上次经验重新尝试' : supplementOfContractId ? '开始补足行动' : isClosure ? '创建补齐并收束节点' : '开始一项推进'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">先和 AI 把本次行动收敛为可验证的契约；只有通过冻结审核，才会写入节点链。</p>

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
              {projects.filter((project) => !project.archivedAt).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.isDefault ? '默认项目 · ' : ''}
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedProject && selectedContract && activeRevision ? (
          <div className="rounded-md border border-rail bg-paper p-4">
            <div className="font-mono text-xs font-semibold text-signal">
              {selectedProject.isDefault ? '默认项目合约' : '当前项目合约'}
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{selectedContract.name}</div>
            <p className="mt-2 text-sm leading-6 text-graphite">{selectedContract.description}</p>
            <div className="mt-3 flex items-start gap-2 border-t border-rail pt-3 text-xs leading-5 text-graphite">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
              新行为只能使用当前项目合约；要调整审查规则，需要进入项目设置修改合约。
            </div>
          </div>
        ) : null}

        {sourceContractIds && sourceContractIds.length > 1 ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-3 grid gap-2">
              {sourceContractIds.map((sourceId) => {
                const source = contracts.find((contract) => contract.id === sourceId)
                return source ? <div key={source.id} className="text-sm font-semibold text-ink">{source.title}</div> : null
              })}
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">这是一项普通推进，只是同时引用多条已经锁定的完成记录。提交结果后，智能合约仍按本节点的规则审查。</p>
          </div>
        ) : null}

        {!(sourceContractIds && sourceContractIds.length > 1) && parentContract ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{parentContract.title}</div>
            <p className="mt-1 text-sm leading-6 text-graphite">
              {closureSourceIds?.includes(parentContract.id) ? '本节点完成时会与这项未闭合推进一起接受审查并收束。' : fork ? '这项行为会从这条完成记录拆出一条独立路径。' : '这项行为会从这条完成记录继续。'}
            </p>
          </div>
        ) : null}

        {selectedProject ? <PlanningConversation projectId={selectedProject.id} parentContractId={parentContractId} sourceContractIds={sourceContractIds} branchId={branchId} fork={fork} closureSourceIds={closureSourceIds} supplementOfContractId={supplementOfContractId} retryOfContractId={retryOfContractId} onCreate={onCreate} /> : null}
      </div>
    </section>
  )
}
